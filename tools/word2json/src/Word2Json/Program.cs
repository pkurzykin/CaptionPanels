using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Word2Json;

internal static class Program
{
    private static int Main(string[] args)
    {
        try
        {
            if (args.Length == 0 || args[0] is "-h" or "--help")
            {
                PrintHelp();
                return 2;
            }

            var inputPath = args[0];
            if (!File.Exists(inputPath))
            {
                Console.Error.WriteLine($"Input not found: {inputPath}");
                return 3;
            }

            string? outPath = null;
            var pretty = false;

            for (var i = 1; i < args.Length; i++)
            {
                var a = args[i];
                if (a == "--out")
                {
                    if (i + 1 >= args.Length)
                    {
                        Console.Error.WriteLine("Missing value after --out");
                        return 2;
                    }
                    outPath = args[++i];
                }
                else if (a == "--pretty")
                {
                    pretty = true;
                }
                else
                {
                    Console.Error.WriteLine($"Unknown arg: {a}");
                    return 2;
                }
            }

            if (string.IsNullOrWhiteSpace(outPath))
            {
                var dir = Path.GetDirectoryName(Path.GetFullPath(inputPath)) ?? ".";
                var name = Path.GetFileNameWithoutExtension(inputPath);
                outPath = Path.Combine(dir, name + ".json");
            }

            var model = DocxParser.Parse(inputPath);

            var jsonOptions = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
                WriteIndented = pretty,
                Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
            };

            var json = JsonSerializer.Serialize(model, jsonOptions);
            File.WriteAllText(outPath, json, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));

            // Print resulting path (so the caller can pick it up).
            Console.WriteLine(outPath);
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("Parse error: " + ex.Message);
            return 10;
        }
    }

    private static void PrintHelp()
    {
        Console.WriteLine("word2json <input.docx> [--out <output.json>] [--pretty]");
    }
}
