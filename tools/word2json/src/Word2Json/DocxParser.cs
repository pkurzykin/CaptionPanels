using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;

namespace Word2Json;

internal static class DocxParser
{
    // Style names (must match the Word document)
    private const string STYLE_META_TITLE = "TTL";
    private const string STYLE_META_RUBRIC = "RUBRIC";
    private const string STYLE_GEO = "GEO";

    private const string STYLE_SPK_NAME = "SPK_NAME";
    private const string STYLE_SPK_ROLE = "SPK_ROLE";

    private const string STYLE_TXT_VOICEOVER = "VOICEOVER";
    private const string STYLE_TXT_SYNC = "SYNC";

    private const string STYLE_TECH_FILE = "TECH_FILE";
    private const string STYLE_TECH_TC = "TECH_TC";

    private const string STYLE_IGNORE = "IGNORE";

    public static ScriptJson Parse(string docxPath)
    {
        using var doc = WordprocessingDocument.Open(docxPath, false);
        var body = doc.MainDocumentPart?.Document?.Body
            ?? throw new InvalidOperationException("DOCX has no document body");

        var styleNameById = BuildStyleNameMap(doc);

        var outJson = new ScriptJson();

        var speakerKeyToId = new Dictionary<string, string>(StringComparer.Ordinal);
        var speakerKeyToIndex = new Dictionary<string, int>(StringComparer.Ordinal); // 0-based index in Speakers
        var currentSpeakerKey = "";
        var currentSpeakerId = "";

        var segments = outJson.Segments;
        var segCounter = 0;
        var lastSegmentId = "";

        // tech is stored as a separate entity, attached to last segment id
        var techBySegId = new Dictionary<string, TechJson>(StringComparer.Ordinal);

        // open segment merge state
        var openType = "";
        var openSpeakerId = "";
        var openText = "";

        // GEO: first gets pin=start
        var geoSeen = false;

        void FlushOpenSegment()
        {
            if (string.IsNullOrWhiteSpace(openType) || string.IsNullOrWhiteSpace(openText))
            {
                openType = "";
                openSpeakerId = "";
                openText = "";
                return;
            }

            segCounter++;
            var segId = $"seg_{segCounter}";

            var seg = new SegmentJson
            {
                Id = segId,
                Type = openType,
                Text = openText.Trim(),
                SpeakerId = (openType == "sync" && !string.IsNullOrWhiteSpace(openSpeakerId)) ? openSpeakerId : null
            };
            segments.Add(seg);
            lastSegmentId = segId;

            openType = "";
            openSpeakerId = "";
            openText = "";
        }

        void OpenOrAppend(string segType, string speakerId, string txt)
        {
            txt = NormalizeSpaces(txt);
            if (string.IsNullOrWhiteSpace(txt)) return;

            if (string.IsNullOrWhiteSpace(openType))
            {
                openType = segType;
                openSpeakerId = speakerId;
                openText = txt;
                return;
            }

            if (openType == segType)
            {
                if (segType == "voiceover")
                {
                    openText = JoinWithSpace(openText, txt);
                    return;
                }

                // sync: append only if same speakerId
                if (segType == "sync" && openSpeakerId == speakerId)
                {
                    openText = JoinWithSpace(openText, txt);
                    return;
                }
            }

            // different type or different speaker (for sync)
            FlushOpenSegment();
            openType = segType;
            openSpeakerId = speakerId;
            openText = txt;
        }

        void ProcessParagraph(Paragraph p)
        {
            var styleName = GetParagraphStyleName(p, styleNameById);

            var rawText = GetParagraphTextWithoutStrikethrough(p);
            rawText = CleanEndMarks(rawText).Trim();
            if (string.IsNullOrWhiteSpace(rawText)) return;

            if (IsGlueMarker(rawText))
            {
                // Ignore paragraph; merging happens naturally because we keep segment open.
                return;
            }

            // META
            if (styleName == STYLE_META_TITLE)
            {
                if (string.IsNullOrWhiteSpace(outJson.Meta.Title)) outJson.Meta.Title = rawText;
                return;
            }
            if (styleName == STYLE_META_RUBRIC)
            {
                if (string.IsNullOrWhiteSpace(outJson.Meta.Rubric)) outJson.Meta.Rubric = rawText;
                return;
            }

            // IGNORE
            if (styleName == STYLE_IGNORE) return;

            // SPEAKER NAME
            if (styleName == STYLE_SPK_NAME)
            {
                FlushOpenSegment();

                var spkName = rawText;
                var spkRole = "";
                currentSpeakerKey = MakeSpeakerKey(spkName, spkRole);

                if (speakerKeyToId.TryGetValue(currentSpeakerKey, out var existingId))
                {
                    currentSpeakerId = existingId;
                }
                else
                {
                    currentSpeakerId = $"spk_{speakerKeyToId.Count + 1}";
                    speakerKeyToId[currentSpeakerKey] = currentSpeakerId;

                    var spk = new SpeakerJson { Id = currentSpeakerId, Name = spkName, Role = spkRole };
                    outJson.Speakers.Add(spk);
                    speakerKeyToIndex[currentSpeakerKey] = outJson.Speakers.Count - 1;
                }

                return;
            }

            // SPEAKER ROLE
            if (styleName == STYLE_SPK_ROLE)
            {
                if (!string.IsNullOrWhiteSpace(currentSpeakerId) && speakerKeyToIndex.TryGetValue(currentSpeakerKey, out var idx))
                {
                    var newRole = rawText;
                    var spk = outJson.Speakers[idx];
                    spk.Role = newRole;

                    var oldKey = currentSpeakerKey;
                    var newKey = MakeSpeakerKey(spk.Name, newRole);

                    if (newKey != oldKey)
                    {
                        if (speakerKeyToId.TryGetValue(newKey, out var existingId))
                        {
                            // Reuse existing speaker
                            currentSpeakerId = existingId;
                            currentSpeakerKey = newKey;
                        }
                        else
                        {
                            speakerKeyToId.Remove(oldKey);
                            speakerKeyToIndex.Remove(oldKey);

                            speakerKeyToId[newKey] = spk.Id;
                            speakerKeyToIndex[newKey] = idx;
                            currentSpeakerKey = newKey;
                        }
                    }
                }

                return;
            }

            // GEO
            if (styleName == STYLE_GEO)
            {
                FlushOpenSegment();

                segCounter++;
                var segId = $"seg_{segCounter}";
                var seg = new SegmentJson
                {
                    Id = segId,
                    Type = "geotag",
                    Text = rawText,
                    Pin = (!geoSeen) ? "start" : null
                };
                geoSeen = true;

                segments.Add(seg);
                lastSegmentId = segId;
                return;
            }

            // TECH FILE / TC (attach to lastSegmentId)
            if (styleName == STYLE_TECH_FILE || styleName == STYLE_TECH_TC)
            {
                if (!string.IsNullOrWhiteSpace(lastSegmentId))
                {
                    if (!techBySegId.TryGetValue(lastSegmentId, out var tech))
                    {
                        tech = new TechJson { SegmentId = lastSegmentId, File = "", Tc = "" };
                        techBySegId[lastSegmentId] = tech;
                        outJson.Tech.Add(tech);
                    }

                    if (styleName == STYLE_TECH_FILE)
                    {
                        tech.File = ExtractFileNameOnly(rawText);
                    }
                    else
                    {
                        tech.Tc = rawText;
                    }
                }

                return;
            }

            // CONTENT
            if (styleName == STYLE_TXT_VOICEOVER)
            {
                OpenOrAppend("voiceover", "", rawText);
                return;
            }

            if (styleName == STYLE_TXT_SYNC)
            {
                // If speaker is missing, export sync without speakerId (same as VBA intention).
                OpenOrAppend("sync", currentSpeakerId, rawText);
                return;
            }

            // Unknown style -> ignore
        }

        // Traverse in document order (table-aware)
        foreach (var el in body.Elements<OpenXmlElement>())
        {
            if (el is Paragraph p)
            {
                ProcessParagraph(p);
                continue;
            }

            if (el is Table t)
            {
                foreach (var tr in t.Elements<TableRow>())
                {
                    foreach (var tc in tr.Elements<TableCell>())
                    {
                        foreach (var p2 in tc.Descendants<Paragraph>())
                        {
                            ProcessParagraph(p2);
                        }
                    }
                }
            }
        }

        // flush last open segment
        FlushOpenSegment();

        return outJson;
    }

    private static Dictionary<string, string> BuildStyleNameMap(WordprocessingDocument doc)
    {
        var map = new Dictionary<string, string>(StringComparer.Ordinal);
        var styles = doc.MainDocumentPart?.StyleDefinitionsPart?.Styles;
        if (styles == null) return map;

        foreach (var st in styles.Elements<Style>())
        {
            var id = st.StyleId?.Value;
            var name = st.StyleName?.Val?.Value;
            if (!string.IsNullOrWhiteSpace(id) && !string.IsNullOrWhiteSpace(name))
            {
                map[id] = name;
            }
        }

        return map;
    }

    private static string GetParagraphStyleName(Paragraph p, Dictionary<string, string> styleNameById)
    {
        var styleId = p.ParagraphProperties?.ParagraphStyleId?.Val?.Value;
        if (string.IsNullOrWhiteSpace(styleId)) return "";

        styleNameById.TryGetValue(styleId, out var resolvedName);

        // Our contract is based on style names, but to be robust we accept both id and name.
        if (IsKnownStyle(resolvedName)) return resolvedName!;
        if (IsKnownStyle(styleId)) return styleId;

        return "";
    }

    private static bool IsKnownStyle(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return false;
        return s is STYLE_META_TITLE or STYLE_META_RUBRIC or STYLE_GEO
            or STYLE_SPK_NAME or STYLE_SPK_ROLE
            or STYLE_TXT_VOICEOVER or STYLE_TXT_SYNC
            or STYLE_TECH_FILE or STYLE_TECH_TC
            or STYLE_IGNORE;
    }
    private static string GetParagraphTextWithoutStrikethrough(Paragraph p)
    {
        var sb = new System.Text.StringBuilder();

        foreach (var run in p.Descendants<Run>())
        {
            var rp = run.RunProperties;
            var isStriked = rp?.Strike != null || rp?.DoubleStrike != null;
            if (isStriked) continue;

            foreach (var t in run.Elements<Text>())
            {
                sb.Append(t.Text);
            }
            foreach (var _ in run.Elements<TabChar>())
            {
                sb.Append(' ');
            }
            foreach (var _ in run.Elements<Break>())
            {
                sb.Append('\n');
            }
        }

        return sb.ToString();
    }

    private static string CleanEndMarks(string s)
    {
        if (string.IsNullOrEmpty(s)) return "";

        // Match VBA macro intent: remove CR/LF and tabs.
        return s.Replace("\r\n", " ")
                .Replace("\r", " ")
                .Replace("\n", " ")
                .Replace("\t", " ");
    }

    private static bool IsGlueMarker(string s)
    {
        var t = s.Trim();
        if (t.Length == 0) return false;

        if (t == "+") return true;

        var lower = t.ToLowerInvariant();
        if (lower == "склейка") return true;
        if (lower == "ñêëåéêà") return true;

        return false;
    }

    private static string NormalizeSpaces(string s)
    {
        if (string.IsNullOrEmpty(s)) return "";

        var t = System.Text.RegularExpressions.Regex.Replace(s, @"\s+", " ").Trim();

        // Remove spaces before punctuation (as in VBA)
        t = t.Replace(" ,", ",")
             .Replace(" .", ".")
             .Replace(" ;", ";")
             .Replace(" :", ":")
             .Replace(" !", "!")
             .Replace(" ?", "?");

        return t;
    }

    private static string JoinWithSpace(string a, string b)
    {
        a = a.Trim();
        b = b.Trim();
        if (a.Length == 0) return b;
        if (b.Length == 0) return a;
        return a + " " + b;
    }

    private static string MakeSpeakerKey(string name, string role)
    {
        name = NormalizeSpaces(name);
        role = NormalizeSpaces(role);
        return name + "|" + role;
    }

    private static string ExtractFileNameOnly(string s)
    {
        var t = s.Trim();
        var pos1 = t.LastIndexOf('/');
        var pos2 = t.LastIndexOf('\\');
        var pos = Math.Max(pos1, pos2);

        return pos >= 0 ? t[(pos + 1)..] : t;
    }
}
