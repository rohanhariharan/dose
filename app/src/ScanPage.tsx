import { useEffect, useRef, useState } from "react";
import { ReadingBeam } from "./PixelBits";

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
  onCapture: (dataUrl: string, allowCloud: boolean, signal: AbortSignal) => Promise<void>;
  onManual: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const cameraRequest = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [allowCloud, setAllowCloud] = useState(false);

  const startCamera = async () => {
    const request = ++cameraRequest.current;
    try {
      setBlocked(false);
      setNote(null);
      const next = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
        audio: false,
      });
      if (request !== cameraRequest.current) {
        next.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = next;
      if (video.current) {
        video.current.srcObject = stream.current;
        await video.current.play().catch(() => {});
      }
    } catch (error) {
      if (request !== cameraRequest.current) return;
      const denied =
        error instanceof DOMException &&
        (error.name === "NotAllowedError" || error.name === "NotFoundError");
      setBlocked(true);
      setNote(
        denied
          ? "Camera unavailable. Choose a label photo or enter the medicine manually."
          : "The camera did not start. Choose a photo or try again.",
      );
    }
  };

  useEffect(() => {
    void startCamera();
    return () => {
      cameraRequest.current++;
      pending.current?.abort();
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

  const readPhoto = async (load: () => Promise<string>) => {
    if (pending.current) return;
    const request = new AbortController();
    pending.current = request;
    setBusy(true);
    setNote("Reading the label…");
    try {
      const dataUrl = await load();
      if (request.signal.aborted) return;
      setPhoto(dataUrl);
      await onCapture(dataUrl, allowCloud, request.signal);
    } catch {
      if (!request.signal.aborted) {
        setPhoto(null);
        setNote("Couldn’t read this photo. Choose a JPG or PNG, or enter it manually.");
      }
    } finally {
      if (!request.signal.aborted) {
        pending.current = null;
        setBusy(false);
      }
    }
  };

  const choosePhoto = (file: File) => {
    if (!["image/jpeg", "image/png"].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setNote("Choose a JPG or PNG up to 10 MB.");
      return;
    }
    void readPhoto(() => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject();
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    }));
  };

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
    void readPhoto(async () => dataUrl);
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
        <p className="scan-hint" role="status">{note ?? "Fit the label in the box."}</p>

        {!busy ? (
          <>
          {blocked ? (
            <button className="scan-cta" type="button" onClick={() => void startCamera()}>Retry camera</button>
          ) : (
            <button className="shutter" type="button" onClick={capture} aria-label="Take photo" />
          )}
          <div className="scan-choice">
            <button className="scan-retake" type="button" onClick={() => fileInput.current?.click()}>Choose a label photo</button>
            <button className="quiet scan-manual" type="button" onClick={onManual}>Enter manually</button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png"
            aria-label="Label photo"
            hidden
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) choosePhoto(file);
            }}
          />
          <label className="scan-consent">
            <input type="checkbox" checked={allowCloud} onChange={(event) => setAllowCloud(event.target.checked)} />
            Send this photo to Gemini if the local read is uncertain
          </label>
          </>
        ) : null}
      </footer>
    </div>
  );
}
