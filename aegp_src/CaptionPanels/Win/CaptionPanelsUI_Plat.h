#ifndef CAPTIONPANELS_UI_PLAT_H_
#define CAPTIONPANELS_UI_PLAT_H_

#include "../CaptionPanelsUI.h"
#include "SPBasic.h"
#include "AEConfig.h"

#ifdef AE_OS_WIN
	#include <windows.h>
#endif

#include <string>
#include <wrl.h>

struct ICoreWebView2Environment;
struct ICoreWebView2Controller;
struct ICoreWebView2;

class CaptionPanelsUI_Plat : public CaptionPanelsUI
{
public:
	explicit CaptionPanelsUI_Plat(	SPBasicSuite* spbP,
								AEGP_PanelH panelH, 
								AEGP_PlatformViewRef platformWindowRef,
								AEGP_PanelFunctions1* outFunctionTable);
	~CaptionPanelsUI_Plat();


protected:
	void InvalidateAll() override;

private:
	void operator=(const CaptionPanelsUI&);
	CaptionPanelsUI_Plat(const CaptionPanelsUI_Plat&); // private, unimplemented


	typedef LRESULT (CALLBACK* WindowProc)(	HWND	hWnd, 
		UINT	message, 
		WPARAM	wParam, 
		LPARAM	lParam);

	static LRESULT CALLBACK				StaticOSWindowWndProc(	HWND	hWnd, 
		UINT	message, 
		WPARAM	wParam, 
		LPARAM	lParam);


	LRESULT OSWindowWndProc(	HWND	hWnd, 
		UINT	message, 
		WPARAM	wParam, 
		LPARAM	lParam);

	void InitWebView();
	void CreateWebViewEnvironment();
	void ScheduleInitWebView();
	void ResizeWebView();
	void NavigateToUI();
	void HandleWebMessage(const std::wstring& json);
	void PostJson(const std::wstring& json);

	WindowProc i_prevWindowProc;
	HWND i_host_hwnd;
	UINT_PTR i_init_timer;
	int i_init_attempts;
	HRESULT i_last_init_hr;
	bool i_com_initialized;
	bool i_jsx_loaded;
	std::wstring i_root_dir;
	std::wstring i_user_data_dir;

	Microsoft::WRL::ComPtr<ICoreWebView2Environment> i_webview_env;
	Microsoft::WRL::ComPtr<ICoreWebView2Controller> i_webview_controller;
	Microsoft::WRL::ComPtr<ICoreWebView2> i_webview;
};

#endif
