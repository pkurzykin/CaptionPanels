using System.Text.Json;

namespace Word2Json;

internal sealed class ParserRules
{
    public StyleRules Styles { get; set; } = new();
    public MergeRules Merge { get; set; } = new();
    public GeotagCleanupRules GeotagCleanup { get; set; } = new();

    public static ParserRules CreateDefault()
    {
        return new ParserRules();
    }

    public void Normalize()
    {
        Styles ??= new StyleRules();
        Merge ??= new MergeRules();
        GeotagCleanup ??= new GeotagCleanupRules();

        Styles.Normalize();
        Merge.Normalize();
        GeotagCleanup.Normalize();
    }
}

internal sealed class StyleRules
{
    public string MetaTitle { get; set; } = "TTL";
    public string MetaRubric { get; set; } = "RUBRIC";
    public string Geotag { get; set; } = "GEO";
    public string SpeakerName { get; set; } = "SPK_NAME";
    public string SpeakerRole { get; set; } = "SPK_ROLE";
    public string Voiceover { get; set; } = "VOICEOVER";
    public string Sync { get; set; } = "SYNC";
    public string TechFile { get; set; } = "TECH_FILE";
    public string TechTc { get; set; } = "TECH_TC";
    public List<string> Ignore { get; set; } = new() { "IGNORE" };

    public bool IsIgnoreStyle(string? styleName)
    {
        if (string.IsNullOrWhiteSpace(styleName))
            return false;
        return Ignore.Contains(styleName);
    }

    public bool IsKnownStyle(string? styleName)
    {
        if (string.IsNullOrWhiteSpace(styleName))
            return false;

        return styleName == MetaTitle
            || styleName == MetaRubric
            || styleName == Geotag
            || styleName == SpeakerName
            || styleName == SpeakerRole
            || styleName == Voiceover
            || styleName == Sync
            || styleName == TechFile
            || styleName == TechTc
            || IsIgnoreStyle(styleName);
    }

    public void Normalize()
    {
        MetaTitle = NormalizeOrDefault(MetaTitle, "TTL");
        MetaRubric = NormalizeOrDefault(MetaRubric, "RUBRIC");
        Geotag = NormalizeOrDefault(Geotag, "GEO");
        SpeakerName = NormalizeOrDefault(SpeakerName, "SPK_NAME");
        SpeakerRole = NormalizeOrDefault(SpeakerRole, "SPK_ROLE");
        Voiceover = NormalizeOrDefault(Voiceover, "VOICEOVER");
        Sync = NormalizeOrDefault(Sync, "SYNC");
        TechFile = NormalizeOrDefault(TechFile, "TECH_FILE");
        TechTc = NormalizeOrDefault(TechTc, "TECH_TC");

        if (Ignore == null || Ignore.Count == 0)
        {
            Ignore = new List<string> { "IGNORE" };
            return;
        }

        var normalized = new List<string>();
        foreach (var item in Ignore)
        {
            if (string.IsNullOrWhiteSpace(item))
                continue;
            normalized.Add(item.Trim());
        }

        if (normalized.Count == 0)
            normalized.Add("IGNORE");

        Ignore = normalized;
    }

    private static string NormalizeOrDefault(string value, string fallback)
    {
        if (string.IsNullOrWhiteSpace(value))
            return fallback;
        return value.Trim();
    }
}

internal sealed class MergeRules
{
    public bool Voiceover { get; set; } = true;
    public bool SyncSameSpeaker { get; set; } = true;

    public void Normalize()
    {
        // Booleans are always valid; method is kept for structural symmetry.
    }
}

internal sealed class GeotagCleanupRules
{
    public bool StripPrefixes { get; set; } = true;
    public bool StripOnlyAtStart { get; set; } = true;
    public bool IgnoreCase { get; set; } = true;
    public List<string> PrefixPatterns { get; set; } = new()
    {
        @"гео\s*[:：\-–—]?\s*",
        @"гео\s*[\-–—]?\s*тег\s*[:：\-–—]?\s*",
        @"геотег\s*[:：\-–—]?\s*"
    };

    public void Normalize()
    {
        if (PrefixPatterns == null || PrefixPatterns.Count == 0)
        {
            PrefixPatterns = new List<string>
            {
                @"гео\s*[:：\-–—]?\s*",
                @"гео\s*[\-–—]?\s*тег\s*[:：\-–—]?\s*",
                @"геотег\s*[:：\-–—]?\s*"
            };
            return;
        }

        var normalized = new List<string>();
        foreach (var pattern in PrefixPatterns)
        {
            if (string.IsNullOrWhiteSpace(pattern))
                continue;
            normalized.Add(pattern.Trim());
        }

        if (normalized.Count == 0)
        {
            normalized.Add(@"гео\s*[:：\-–—]?\s*");
            normalized.Add(@"гео\s*[\-–—]?\s*тег\s*[:：\-–—]?\s*");
            normalized.Add(@"геотег\s*[:：\-–—]?\s*");
        }

        PrefixPatterns = normalized;
    }
}

internal static class ParserRulesLoader
{
    public static ParserRules Load(string? explicitPath)
    {
        var rulesPath = explicitPath;

        if (string.IsNullOrWhiteSpace(rulesPath))
        {
            var fallbackPath = Path.Combine(AppContext.BaseDirectory, "word2json.rules.json");
            if (!File.Exists(fallbackPath))
            {
                var defaults = ParserRules.CreateDefault();
                defaults.Normalize();
                return defaults;
            }

            rulesPath = fallbackPath;
        }

        if (!File.Exists(rulesPath))
            throw new FileNotFoundException("Rules file not found", rulesPath);

        var json = File.ReadAllText(rulesPath);
        var options = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            AllowTrailingCommas = true,
            ReadCommentHandling = JsonCommentHandling.Skip
        };

        var rules = JsonSerializer.Deserialize<ParserRules>(json, options);
        if (rules == null)
            throw new InvalidOperationException($"Failed to deserialize rules file: {rulesPath}");

        rules.Normalize();
        return rules;
    }
}
