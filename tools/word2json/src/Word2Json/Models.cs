namespace Word2Json;

public sealed class ScriptJson
{
    public MetaJson Meta { get; set; } = new();
    public List<SpeakerJson> Speakers { get; set; } = new();
    public List<SegmentJson> Segments { get; set; } = new();
    public List<TechJson> Tech { get; set; } = new();
}

public sealed class MetaJson
{
    public string Title { get; set; } = "";
    public string Rubric { get; set; } = "";
}

public sealed class SpeakerJson
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Role { get; set; } = "";
}

public sealed class SegmentJson
{
    public string Id { get; set; } = "";
    public string Type { get; set; } = "";
    public string Text { get; set; } = "";
    public string? SpeakerId { get; set; }
    public string? Pin { get; set; }
}

public sealed class TechJson
{
    public string SegmentId { get; set; } = "";
    public string File { get; set; } = "";
    public string Tc { get; set; } = "";
}
