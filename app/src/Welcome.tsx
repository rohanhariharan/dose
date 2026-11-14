import Dots from "./Dots";
import PixelScene from "./PixelScene";
import "./welcome.css";

/** Page one of three. A quiet welcome: the dot-matrix scene, one line about
 *  what the app is, and a single way in. */

export default function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="welcome">
      <div className="welcome-stack">
        <Dots active={0} />

        <section className="card" aria-labelledby="welcome-title">
          <div className="card-art">
            <PixelScene />
          </div>

          <div className="card-copy">
            <h1 id="welcome-title">Welcome to Dose</h1>
            <p>Everything you take, in one quiet place. Nothing leaves this computer.</p>
            <button className="primary" type="button" onClick={onStart}>
              Get started
            </button>
          </div>
        </section>

        <p className="foot">Prototype · not medical advice</p>
      </div>
    </div>
  );
}
