#include "CaptionPanelsUI_Plat.h"
#include "CaptionPanels.h"
#include "AEGP_SuiteHandler.h"

#include <WebView2.h>
#include <ShlObj.h>
#include <Shlwapi.h>
#include <wrl.h>

#include <cwchar>
#include <cwctype>
#include <cstring>
#include <string>

using Microsoft::WRL::Callback;
using Microsoft::WRL::ComPtr;

namespace {

const wchar_t kOSWndObjectProperty[] = L"CaptionPanelsUI_PlatPtr";
const UINT_PTR kInitTimerId = 1;
const int kMaxInitAttempts = 5;

HWND ToHwnd(AEGP_PlatformViewRef ref)
{
	return reinterpret_cast<HWND>(ref);
}

void ShowHresultError(HWND hwnd, const wchar_t* title, const wchar_t* message, HRESULT hr)
{
	wchar_t buf[512] = {0};
	swprintf(buf, 512, L"%s\nHRESULT: 0x%08X", message, static_cast<unsigned int>(hr));
	MessageBoxW(hwnd, buf, title, MB_OK | MB_ICONERROR);
}

std::wstring WideFromUtf8(const std::string& text)
{
	if (text.empty()) return L"";
	int len = MultiByteToWideChar(CP_UTF8, 0, text.c_str(), static_cast<int>(text.size()), nullptr, 0);
	std::wstring out(len, L'\0');
	MultiByteToWideChar(CP_UTF8, 0, text.c_str(), static_cast<int>(text.size()), &out[0], len);
	return out;
}

std::string Utf8FromWide(const std::wstring& text)
{
	if (text.empty()) return "";
	int len = WideCharToMultiByte(CP_UTF8, 0, text.c_str(), static_cast<int>(text.size()), nullptr, 0, nullptr, nullptr);
	std::string out(len, '\0');
	WideCharToMultiByte(CP_UTF8, 0, text.c_str(), static_cast<int>(text.size()), &out[0], len, nullptr, nullptr);
	return out;
}

std::string DecodeAeString(const std::string& bytes)
{
	if (bytes.empty()) return bytes;

	// Strip trailing nulls (AE often returns a null-terminated buffer).
	std::string trimmed = bytes;
	while (!trimmed.empty() && trimmed.back() == '\0') trimmed.pop_back();
	if (trimmed.empty()) return trimmed;

	// If we still have embedded nulls, treat as UTF-16LE.
	if (trimmed.find('\0') != std::string::npos) {
		size_t len = trimmed.size() / 2;
		std::wstring w(len, L'\0');
		memcpy(&w[0], trimmed.data(), len * sizeof(wchar_t));
		return Utf8FromWide(w);
	}

	// Handle UTF-16LE BOM without embedded nulls (rare but safe).
	if (trimmed.size() >= 2) {
		unsigned char b0 = static_cast<unsigned char>(trimmed[0]);
		unsigned char b1 = static_cast<unsigned char>(trimmed[1]);
		if (b0 == 0xFF && b1 == 0xFE) {
			size_t len = (trimmed.size() - 2) / 2;
			std::wstring w(len, L'\0');
			memcpy(&w[0], trimmed.data() + 2, len * sizeof(wchar_t));
			return Utf8FromWide(w);
		}
	}

	return trimmed;
}

std::wstring GetModuleDir()
{
	HMODULE module = nullptr;
	if (!GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS | GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
		reinterpret_cast<LPCWSTR>(&GetModuleDir), &module)) {
		return L"";
	}
	wchar_t path[MAX_PATH] = {0};
	DWORD len = GetModuleFileNameW(module, path, static_cast<DWORD>(sizeof(path) / sizeof(path[0])));
	if (len == 0) return L"";
	std::wstring full(path, len);
	size_t pos = full.find_last_of(L"\\/");
	if (pos == std::wstring::npos) return L"";
	return full.substr(0, pos);
}

std::wstring JoinPath(const std::wstring& a, const std::wstring& b)
{
	if (a.empty()) return b;
	if (b.empty()) return a;
	wchar_t tail = a.back();
	if (tail == L'\\' || tail == L'/') return a + b;
	return a + L"\\" + b;
}

std::wstring ToFileUrl(const std::wstring& path)
{
	DWORD len = 0;
	HRESULT hr = UrlCreateFromPathW(path.c_str(), nullptr, &len, 0);
	if (FAILED(hr) || len == 0) {
		std::wstring url = L"file:///" + path;
		for (size_t i = 0; i < url.size(); ++i) {
			if (url[i] == L'\\') url[i] = L'/';
		}
		return url;
	}
	std::wstring url(len, L'\0');
	hr = UrlCreateFromPathW(path.c_str(), &url[0], &len, 0);
	if (FAILED(hr)) return L"";
	if (!url.empty() && url.back() == L'\0') url.pop_back();
	return url;
}

bool FileExists(const std::wstring& path)
{
	DWORD attrs = GetFileAttributesW(path.c_str());
	return (attrs != INVALID_FILE_ATTRIBUTES) && !(attrs & FILE_ATTRIBUTE_DIRECTORY);
}

std::wstring GetUserDataFolder()
{
	PWSTR base = nullptr;
	if (SUCCEEDED(SHGetKnownFolderPath(FOLDERID_LocalAppData, 0, nullptr, &base))) {
		std::wstring dir = JoinPath(base, L"CaptionPanels\\WebView2");
		CoTaskMemFree(base);
		SHCreateDirectoryExW(nullptr, dir.c_str(), nullptr);
		return dir;
	}
	wchar_t temp[MAX_PATH] = {0};
	if (GetTempPathW(static_cast<DWORD>(sizeof(temp) / sizeof(temp[0])), temp) > 0) {
		std::wstring dir = JoinPath(temp, L"CaptionPanels\\WebView2");
		SHCreateDirectoryExW(nullptr, dir.c_str(), nullptr);
		return dir;
	}
	return L"";
}

std::wstring EscapeJsonString(const std::wstring& text)
{
	std::wstring out;
	out.reserve(text.size() + 16);
	for (wchar_t c : text) {
		switch (c) {
		case L'\\': out += L"\\\\"; break;
		case L'\"': out += L"\\\""; break;
		case L'\b': out += L"\\b"; break;
		case L'\f': out += L"\\f"; break;
		case L'\n': out += L"\\n"; break;
		case L'\r': out += L"\\r"; break;
		case L'\t': out += L"\\t"; break;
		default:
			if (c < 0x20) {
				wchar_t buf[7] = {0};
				swprintf(buf, 7, L"\\u%04X", static_cast<unsigned int>(c));
				out += buf;
			} else {
				out.push_back(c);
			}
		}
	}
	return out;
}

std::string EscapeJsString(const std::string& text)
{
	std::string out;
	out.reserve(text.size() + 16);
	for (char c : text) {
		switch (c) {
		case '\\': out += "\\\\"; break;
		case '"': out += "\\\""; break;
		case '\n': out += "\\n"; break;
		case '\r': out += "\\r"; break;
		case '\t': out += "\\t"; break;
		default: out.push_back(c); break;
		}
	}
	return out;
}

struct JsonMessage {
	std::wstring id;
	std::wstring type;
	std::wstring payload;
	bool expect_result = true;
};

void SkipWs(const std::wstring& text, size_t& i)
{
	while (i < text.size() && iswspace(text[i])) ++i;
}

bool ReadJsonString(const std::wstring& text, size_t& i, std::wstring& out)
{
	if (i >= text.size() || text[i] != L'\"') return false;
	++i;
	while (i < text.size()) {
		wchar_t c = text[i++];
		if (c == L'\"') return true;
		if (c == L'\\') {
			if (i >= text.size()) return false;
			wchar_t esc = text[i++];
			switch (esc) {
			case L'\"': out.push_back(L'\"'); break;
			case L'\\': out.push_back(L'\\'); break;
			case L'/': out.push_back(L'/'); break;
			case L'b': out.push_back(L'\b'); break;
			case L'f': out.push_back(L'\f'); break;
			case L'n': out.push_back(L'\n'); break;
			case L'r': out.push_back(L'\r'); break;
			case L't': out.push_back(L'\t'); break;
			case L'u': {
				if (i + 4 > text.size()) return false;
				unsigned int code = 0;
				for (int k = 0; k < 4; ++k) {
					wchar_t h = text[i + k];
					code <<= 4;
					if (h >= L'0' && h <= L'9') code |= static_cast<unsigned int>(h - L'0');
					else if (h >= L'a' && h <= L'f') code |= static_cast<unsigned int>(h - L'a' + 10);
					else if (h >= L'A' && h <= L'F') code |= static_cast<unsigned int>(h - L'A' + 10);
					else return false;
				}
				out.push_back(static_cast<wchar_t>(code));
				i += 4;
				break;
			}
			default:
				out.push_back(esc);
				break;
			}
		} else {
			out.push_back(c);
		}
	}
	return false;
}

bool SkipJsonValue(const std::wstring& text, size_t& i)
{
	if (i >= text.size()) return false;
	wchar_t c = text[i];
	if (c == L'\"') {
		std::wstring tmp;
		return ReadJsonString(text, i, tmp);
	}
	if (c == L'{' || c == L'[') {
		wchar_t open = c;
		wchar_t close = (c == L'{') ? L'}' : L']';
		int depth = 0;
		bool in_str = false;
		bool escape = false;
		for (; i < text.size(); ++i) {
			wchar_t ch = text[i];
			if (in_str) {
				if (escape) {
					escape = false;
				} else if (ch == L'\\') {
					escape = true;
				} else if (ch == L'\"') {
					in_str = false;
				}
				continue;
			}
			if (ch == L'\"') {
				in_str = true;
				continue;
			}
			if (ch == open) ++depth;
			if (ch == close) {
				--depth;
				if (depth == 0) {
					++i;
					return true;
				}
			}
		}
		return false;
	}
	while (i < text.size()) {
		wchar_t ch = text[i];
		if (iswspace(ch) || ch == L',' || ch == L'}' || ch == L']') return true;
		++i;
	}
	return true;
}

bool ReadJsonBool(const std::wstring& text, size_t& i, bool& value)
{
	if (text.compare(i, 4, L"true") == 0) {
		value = true;
		i += 4;
		return true;
	}
	if (text.compare(i, 5, L"false") == 0) {
		value = false;
		i += 5;
		return true;
	}
	return false;
}

bool ParseJsonMessage(const std::wstring& text, JsonMessage& out)
{
	size_t i = 0;
	SkipWs(text, i);
	if (i >= text.size() || text[i] != L'{') return false;
	++i;
	while (i < text.size()) {
		SkipWs(text, i);
		if (i < text.size() && text[i] == L'}') {
			++i;
			break;
		}
		std::wstring key;
		if (!ReadJsonString(text, i, key)) return false;
		SkipWs(text, i);
		if (i >= text.size() || text[i] != L':') return false;
		++i;
		SkipWs(text, i);

		if (key == L"id") {
			std::wstring val;
			if (!ReadJsonString(text, i, val)) return false;
			out.id = val;
		} else if (key == L"type") {
			std::wstring val;
			if (!ReadJsonString(text, i, val)) return false;
			out.type = val;
		} else if (key == L"payload") {
			std::wstring val;
			if (!ReadJsonString(text, i, val)) return false;
			out.payload = val;
		} else if (key == L"expectResult") {
			bool v = true;
			if (ReadJsonBool(text, i, v)) {
				out.expect_result = v;
			} else {
				if (!SkipJsonValue(text, i)) return false;
			}
		} else {
			if (!SkipJsonValue(text, i)) return false;
		}

		SkipWs(text, i);
		if (i < text.size() && text[i] == L',') {
			++i;
			continue;
		}
		if (i < text.size() && text[i] == L'}') {
			++i;
			break;
		}
	}
	return !out.type.empty();
}

bool ExecuteScriptUtf8(const std::string& script, std::string* out_result, std::string* out_error)
{
	SPBasicSuite* pica_basicP = CaptionPanels_GetPicaBasic();
	if (!pica_basicP) {
		if (out_error) *out_error = "No SPBasicSuite";
		return false;
	}
	AEGP_SuiteHandler suites(pica_basicP);
	A_Boolean available = FALSE;
	suites.UtilitySuite6()->AEGP_IsScriptingAvailable(&available);
	if (!available) {
		if (out_error) *out_error = "Scripting not available";
		return false;
	}

	AEGP_MemHandle resultH = nullptr;
	AEGP_MemHandle errorH = nullptr;
	A_Err err = suites.UtilitySuite6()->AEGP_ExecuteScript(CaptionPanels_GetPluginId(), script.c_str(), FALSE, &resultH, &errorH);

	std::string result;
	std::string error;
	if (resultH) {
		void* p = nullptr;
		AEGP_MemSize size = 0;
		suites.MemorySuite1()->AEGP_GetMemHandleSize(resultH, &size);
		suites.MemorySuite1()->AEGP_LockMemHandle(resultH, &p);
		if (p && size > 0) result.assign(static_cast<const char*>(p), static_cast<size_t>(size));
		suites.MemorySuite1()->AEGP_UnlockMemHandle(resultH);
		suites.MemorySuite1()->AEGP_FreeMemHandle(resultH);
	}
	if (errorH) {
		void* p = nullptr;
		AEGP_MemSize size = 0;
		suites.MemorySuite1()->AEGP_GetMemHandleSize(errorH, &size);
		suites.MemorySuite1()->AEGP_LockMemHandle(errorH, &p);
		if (p && size > 0) error.assign(static_cast<const char*>(p), static_cast<size_t>(size));
		suites.MemorySuite1()->AEGP_UnlockMemHandle(errorH);
		suites.MemorySuite1()->AEGP_FreeMemHandle(errorH);
	}

	result = DecodeAeString(result);
	error = DecodeAeString(error);

	if (out_result) *out_result = result;
	if (out_error) *out_error = error;
	return (err == A_Err_NONE && error.empty());
}

} // namespace

CaptionPanelsUI_Plat::CaptionPanelsUI_Plat(SPBasicSuite* spbP, AEGP_PanelH panelH,
	AEGP_PlatformViewRef platformWindowRef,
	AEGP_PanelFunctions1* outFunctionTable)
	: CaptionPanelsUI(spbP, panelH, platformWindowRef, outFunctionTable),
	i_prevWindowProc(nullptr),
	i_host_hwnd(nullptr),
	i_init_timer(0),
	i_init_attempts(0),
	i_last_init_hr(S_OK),
	i_com_initialized(false),
	i_jsx_loaded(false)
{
	i_root_dir = GetModuleDir();

	HRESULT hr = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
	if (hr == S_OK || hr == S_FALSE) {
		i_com_initialized = true;
	}

	HWND hwnd = ToHwnd(platformWindowRef);
	i_prevWindowProc = (WindowProc)GetWindowLongPtrW(hwnd, GWLP_WNDPROC);
	SetWindowLongPtrW(hwnd, GWLP_WNDPROC, (LONG_PTR)CaptionPanelsUI_Plat::StaticOSWindowWndProc);
	::SetPropW(hwnd, kOSWndObjectProperty, (HANDLE)this);

	RECT bounds = {0, 0, 1, 1};
	GetClientRect(hwnd, &bounds);
	i_host_hwnd = CreateWindowExW(0, L"STATIC", L"", WS_CHILD | WS_VISIBLE,
		0, 0, bounds.right - bounds.left, bounds.bottom - bounds.top,
		hwnd, nullptr, GetModuleHandleW(nullptr), nullptr);

	ScheduleInitWebView();
}

CaptionPanelsUI_Plat::~CaptionPanelsUI_Plat()
{
	if (i_webview_controller) {
		i_webview_controller->Close();
	}
	i_webview = nullptr;
	i_webview_controller = nullptr;
	i_webview_env = nullptr;

	if (i_host_hwnd) {
		DestroyWindow(i_host_hwnd);
		i_host_hwnd = nullptr;
	}

	HWND hwnd = ToHwnd(i_refH);
	if (hwnd) {
		::RemovePropW(hwnd, kOSWndObjectProperty);
		if (i_prevWindowProc) {
			SetWindowLongPtrW(hwnd, GWLP_WNDPROC, (LONG_PTR)i_prevWindowProc);
		}
	}

	if (i_com_initialized) {
		CoUninitialize();
	}
}

LRESULT CALLBACK CaptionPanelsUI_Plat::StaticOSWindowWndProc(HWND hWnd,
	UINT message,
	WPARAM wParam,
	LPARAM lParam)
{
	CaptionPanelsUI_Plat* platPtr = reinterpret_cast<CaptionPanelsUI_Plat*>(::GetPropW(hWnd, kOSWndObjectProperty));
	if (platPtr) {
		return platPtr->OSWindowWndProc(hWnd, message, wParam, lParam);
	}
	return DefWindowProc(hWnd, message, wParam, lParam);
}

LRESULT CaptionPanelsUI_Plat::OSWindowWndProc(HWND hWnd,
	UINT message,
	WPARAM wParam,
	LPARAM lParam)
{
	switch (message) {
	case WM_SIZE:
	case WM_SIZING:
		if (i_host_hwnd) {
			RECT bounds;
			GetClientRect(hWnd, &bounds);
			SetWindowPos(i_host_hwnd, nullptr, 0, 0,
				bounds.right - bounds.left, bounds.bottom - bounds.top,
				SWP_NOZORDER | SWP_NOACTIVATE);
		}
		ResizeWebView();
		break;
	case WM_TIMER:
		if (wParam == kInitTimerId) {
			KillTimer(hWnd, kInitTimerId);
			i_init_timer = 0;
			InitWebView();
			return 0;
		}
		break;
	case WM_DESTROY:
		if (i_webview_controller) {
			i_webview_controller->Close();
		}
		break;
	case WM_NCDESTROY:
		::RemovePropW(hWnd, kOSWndObjectProperty);
		if (i_prevWindowProc) {
			SetWindowLongPtrW(hWnd, GWLP_WNDPROC, (LONG_PTR)i_prevWindowProc);
		}
		break;
	default:
		break;
	}

	if (i_prevWindowProc) {
		return CallWindowProc(i_prevWindowProc, hWnd, message, wParam, lParam);
	}
	return DefWindowProc(hWnd, message, wParam, lParam);
}

void CaptionPanelsUI_Plat::InvalidateAll()
{
	RECT clientArea;
	HWND hwnd = ToHwnd(i_refH);
	if (!hwnd) return;
	GetClientRect(hwnd, &clientArea);
	InvalidateRect(hwnd, &clientArea, FALSE);
}

void CaptionPanelsUI_Plat::InitWebView()
{
	i_user_data_dir = GetUserDataFolder();
	if (i_webview || i_webview_controller) return;
	if (i_init_attempts >= kMaxInitAttempts) {
		ShowHresultError(ToHwnd(i_refH), L"Caption Panels",
			L"Failed to initialize WebView2 after multiple attempts.",
			i_last_init_hr);
		return;
	}
	++i_init_attempts;
	CreateWebViewEnvironment();
}

void CaptionPanelsUI_Plat::CreateWebViewEnvironment()
{
	HRESULT hr = CreateCoreWebView2EnvironmentWithOptions(nullptr,
		i_user_data_dir.empty() ? nullptr : i_user_data_dir.c_str(),
		nullptr,
		Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
			[this](HRESULT result, ICoreWebView2Environment* env) -> HRESULT {
				if (FAILED(result) || !env) {
					i_last_init_hr = result;
					ScheduleInitWebView();
					return S_OK;
				}
				i_webview_env = env;
				HWND host = i_host_hwnd ? i_host_hwnd : ToHwnd(i_refH);
				return i_webview_env->CreateCoreWebView2Controller(host,
					Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
						[this](HRESULT result, ICoreWebView2Controller* controller) -> HRESULT {
							if (FAILED(result) || !controller) {
								i_last_init_hr = result;
								i_webview_env = nullptr;
								ScheduleInitWebView();
								return S_OK;
							}
							i_webview_controller = controller;
							i_webview_controller->get_CoreWebView2(&i_webview);
							ResizeWebView();

							ComPtr<ICoreWebView2Settings> settings;
							if (i_webview && SUCCEEDED(i_webview->get_Settings(&settings)) && settings) {
								settings->put_IsScriptEnabled(TRUE);
								settings->put_AreDevToolsEnabled(FALSE);
							}

							if (i_webview) {
								i_webview->AddScriptToExecuteOnDocumentCreated(
									L"window.external = window.external || {};"
									L"window.external.invoke = function(msg){ if (window.chrome && window.chrome.webview){ window.chrome.webview.postMessage(msg); } };",
									nullptr);

								i_webview->add_WebMessageReceived(
									Callback<ICoreWebView2WebMessageReceivedEventHandler>(
										[this](ICoreWebView2*, ICoreWebView2WebMessageReceivedEventArgs* args) -> HRESULT {
											LPWSTR json = nullptr;
											if (SUCCEEDED(args->get_WebMessageAsJson(&json)) && json) {
												HandleWebMessage(json);
												CoTaskMemFree(json);
											}
											return S_OK;
										}).Get(),
										nullptr);
							}

							NavigateToUI();
							return S_OK;
						}).Get());
			}).Get());
	if (FAILED(hr)) {
		i_last_init_hr = hr;
		ScheduleInitWebView();
	}
}

void CaptionPanelsUI_Plat::ScheduleInitWebView()
{
	if (i_webview || i_webview_controller) return;
	if (i_init_timer) return;
	HWND hwnd = ToHwnd(i_refH);
	if (!hwnd) return;
	i_init_timer = SetTimer(hwnd, kInitTimerId, 500, nullptr);
}

void CaptionPanelsUI_Plat::ResizeWebView()
{
	if (!i_webview_controller) return;
	RECT bounds;
	if (i_host_hwnd) {
		GetClientRect(i_host_hwnd, &bounds);
	} else {
		GetClientRect(ToHwnd(i_refH), &bounds);
	}
	i_webview_controller->put_Bounds(bounds);
}

void CaptionPanelsUI_Plat::NavigateToUI()
{
	if (!i_webview) return;
	std::wstring index_path = JoinPath(i_root_dir, L"client\\index.html");
	if (!FileExists(index_path)) {
		i_webview->NavigateToString(
			L"<html><body style='font-family:Segoe UI, Arial; padding:16px;'>"
			L"<h3>Caption Panels</h3>"
			L"<p>UI file not found:</p>"
			L"<code>client\\index.html</code>"
			L"</body></html>");
		return;
	}
	std::wstring url = ToFileUrl(index_path);
	if (!url.empty()) {
		i_webview->Navigate(url.c_str());
	}
}

void CaptionPanelsUI_Plat::HandleWebMessage(const std::wstring& json)
{
	JsonMessage msg;
	if (!ParseJsonMessage(json, msg)) return;
	if (msg.type != L"evalScript") return;

	if (!i_jsx_loaded) {
		std::wstring jsx_path = JoinPath(i_root_dir, L"host\\index.jsx");
		if (!FileExists(jsx_path)) {
			if (msg.expect_result) {
				std::wstring response = L"{\"id\":\"" + EscapeJsonString(msg.id) +
					L"\",\"ok\":false,\"result\":\"\",\"error\":\"Missing host/index.jsx\"}";
				PostJson(response);
			}
			return;
		}
		std::string jsx_utf8 = Utf8FromWide(jsx_path);
		for (char& c : jsx_utf8) { if (c == '\\') c = '/'; }
		std::string root_utf8 = Utf8FromWide(i_root_dir);
		for (char& c : root_utf8) { if (c == '\\') c = '/'; }
		std::string init_script = "$.evalFile(\"" + EscapeJsString(jsx_utf8) + "\");"
			"if (typeof initPath === 'function') { initPath(\"" + EscapeJsString(root_utf8) + "\"); }";
		std::string init_result;
		std::string init_error;
		i_jsx_loaded = ExecuteScriptUtf8(init_script, &init_result, &init_error);
	}

	std::string payload_utf8 = Utf8FromWide(msg.payload);
	std::string result;
	std::string error;
	bool ok = ExecuteScriptUtf8(payload_utf8, &result, &error);

	if (!msg.expect_result) return;

	std::wstring result_w = WideFromUtf8(result);
	std::wstring error_w = WideFromUtf8(error);
	std::wstring response = L"{\"id\":\"" + EscapeJsonString(msg.id) +
		L"\",\"ok\":" + (ok ? L"true" : L"false") +
		L",\"result\":\"" + EscapeJsonString(result_w) +
		L"\",\"error\":\"" + EscapeJsonString(error_w) + L"\"}";
	PostJson(response);
}

void CaptionPanelsUI_Plat::PostJson(const std::wstring& json)
{
	if (!i_webview) return;
	i_webview->PostWebMessageAsJson(json.c_str());
}
