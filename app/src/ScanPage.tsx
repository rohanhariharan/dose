import { useEffect, useRef, useState } from "react";

/** The capture screen. A live viewfinder, a box the size of a prescription
 *  bottle, and one shutter. Nothing here reads the label yet — the button
 *  freezes a frame so the next build has something real to work from. */
export default function ScanPage({ onClose }: { onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let gone = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (gone) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play().catch(() => {});
        }
      } catch {
        setNote("No camera here — the box is where the bottle goes.");
      }
    })();

    return () => {
      gone = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  const capture = () => {
    const v = video.current;
    if (!v || !v.videoWidth) {
      setNote("Nothing to capture yet.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    setPhoto(canvas.toDataURL("image/jpeg", 0.86));
    setNote("Got it. Reading the label comes next.");
  };

  return (
    <div className="scan" role="dialog" aria-modal="true" aria-label="Scan a medicine">
      {photo ? (
        <img className="scan-media" src={photo} alt="Captured label" />
      ) : (
        <video ref={video} className="scan-media" autoPlay playsInline muted />
      )}

      <header className="scan-top">
        <button className="scan-close" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
        <span className="scan-title">Scan a medicine</span>
      </header>

      <div className="scan-stage">
        <div className="scan-frame" aria-hidden="true">
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
        ) : (
          <button className="shutter" type="button" onClick={capture} aria-label="Take photo" />
        )}
      </footer>
    </div>
  );
}
