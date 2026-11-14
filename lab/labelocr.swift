// labelocr — read the text off a medicine box, on this machine.
//
//   swiftc -O labelocr.swift -o labelocr
//   ./labelocr path/to/photo.jpg > lines.json
//
// Apple's Vision framework, the same recogniser as Live Text. No network, no
// key, no model download — which is what lets the app keep saying "nothing
// leaves this computer". Output is one JSON object: image size plus every
// recognised line with its confidence and box (top-left origin, normalised),
// sorted top-to-bottom so the parser can group blocks without guessing.

import Foundation
import Vision
import AppKit

struct Line: Encodable {
    let text: String
    let conf: Float
    let x: Double
    let y: Double
    let w: Double
    let h: Double
}

struct Page: Encodable {
    let width: Int
    let height: Int
    let lines: [Line]
}

func fail(_ message: String) -> Never {
    FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
    exit(2)
}

let args = CommandLine.arguments
guard args.count >= 2 else { fail("usage: labelocr <image> [--no-correction]") }
let path = args[1]
let correct = !args.contains("--no-correction")

guard let image = NSImage(contentsOfFile: path),
      let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil)
else { fail("could not read image at \(path)") }

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = correct
request.revision = VNRecognizeTextRequestRevision3

do {
    try VNImageRequestHandler(cgImage: cgImage, options: [:]).perform([request])
} catch {
    fail("vision failed: \(error.localizedDescription)")
}

let observations = (request.results ?? []).compactMap { obs -> Line? in
    guard let candidate = obs.topCandidates(1).first else { return nil }
    let box = obs.boundingBox
    // Vision's origin is bottom-left; flip so y grows downwards like a page.
    return Line(
        text: candidate.string,
        conf: candidate.confidence,
        x: Double(box.origin.x),
        y: Double(1 - box.origin.y - box.size.height),
        w: Double(box.size.width),
        h: Double(box.size.height)
    )
}

let sorted = observations.sorted { a, b in
    abs(a.y - b.y) < 0.01 ? a.x < b.x : a.y < b.y
}

let page = Page(width: cgImage.width, height: cgImage.height, lines: sorted)
let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
guard let data = try? encoder.encode(page) else { fail("could not encode output") }
FileHandle.standardOutput.write(data)
