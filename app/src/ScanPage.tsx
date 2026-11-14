import { useEffect, useRef, useState } from "react";

/** The capture screen. A live viewfinder, a box the size of a prescription
 *  bottle, and one shutter.
 *
 *  The shutter crops to the box, not to the whole frame: the box is the promise
 *  the screen makes, and a 250×330 crop is what the reader should see. The crop
 *  is mapped back through `object-fit: cover` — the video is scaled by the
 *  larger of the two ratios and centred, so the box has to be un-scaled and
 *  un-centred before it means anything in source pixels. */

export default function ScanPage({
  onClose,
  onCapture,
  onManual,
}: {
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
  onManual: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);

  const startCamera = async () => {
    try {
      setBlocked(false);
      setNote(null);
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
        audio: false,
      });
      if (video.current) {
        video.current.srcObject = stream.current;
        await video.current.play().catch(() => {});
      }
    } catch (error) {
      const denied =
        error instanceof DOMException &&
        (error.name === "NotAllowedError" || error.name === "NotFoundError");
      setBlocked(denied);
      setNote(
        denied
          ? "The camera is blocked for this page. Allow it, then try again."
          : "The camera did not start. Try again, or type the name.",
      );
    }
  };

  useEffect(() => {
    void startCamera();
    return () => {
      stream.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  /** The part of the video that is actually inside the frame, in source pixels. */
  const cropRect = () => {
    const v = video.current;
    const box = frame.current;
    if (!v || !box || !v.videoWidth) return null;

    const view = v.getBoundingClientRect();
    const target = box.getBoundingClientRect();
    const scale = Math.max(view.width / v.videoWidth, view.height / v.videoHeight);
    const drawnW = v.videoWidth * scale;
    const drawnH = v.videoHeight * scale;
    const offsetX = (view.width - drawnW) / 2;
    const offsetY = (view.height - drawnH) / 2;

    const x = (target.left - view.left - offsetX) / scale;
    const y = (target.top - view.top - offsetY) / scale;
    const w = target.width / scale;
    const h = target.height / scale;

    const clamp = (value: number, max: number) => Math.min(Math.max(0, value), max);
    return {
      x: clamp(x, v.videoWidth),
      y: clamp(y, v.videoHeight),
      w: clamp(w, v.videoWidth - clamp(x, v.videoWidth)),
      h: clamp(h, v.videoHeight - clamp(y, v.videoHeight)),
    };
  };

  const capture = () => {
    const v = video.current;
    const rect = cropRect();
    if (!v || !rect) {
      setNote("The camera isn't ready yet.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(rect.w);
    canvas.height = Math.round(rect.h);
    canvas
      .getContext("2d")
      ?.drawImage(v, rect.x, rect.y, rect.w, rect.h, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setPhoto(dataUrl);
    setNote("Reading the label…");
    onCapture(dataUrl);
  };

  return (
    <div className="scan" role="dialog" aria-modal="true" aria-label="Scan a medicine">
      <video ref={video} className="scan-media" autoPlay playsInline muted />

      <header className="scan-top">
        <button className="scan-close" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
        <span className="scan-title">Scan a medicine</span>
      </header>

      <div className="scan-stage">
        <div className="scan-frame" ref={frame}>
          {photo ? <img className="scan-shot" src={photo} alt="The label you just captured" /> : null}
          <i className="c tl" />
          <i className="c tr" />
          <i className="c bl" />
          <i className="c br" />
        </div>
      </div>

      <footer className="scan-foot">
        <p className="scan-hint">{note ?? "Fit the label in the box."}</p>

        {photo ? (
          <button
            className="scan-retake"
            type="button"
            onClick={() => {
              setPhoto(null);
              setNote(null);
            }}
          >
            Retake
          </button>
        ) : blocked ? (
          <div className="scan-choice">
            <button className="scan-cta" type="button" onClick={() => void startCamera()}>
              Turn on camera
            </button>
            <button className="quiet scan-manual" type="button" onClick={onManual}>
              Enter it manually
            </button>
          </div>
        ) : (
          <button className="shutter" type="button" onClick={capture} aria-label="Take photo" />
        )}
      </footer>
    </div>
  );
}
