import Navbar from "../components/Navbar";
import "../styles/home.css";

function Home() {
  return (
    <>
      <Navbar />

      <section className="hero">
        <h1>Meet People. Make Friends. Find Love.</h1>

        <p>
          Street Meet is Africa's modern social and dating platform where you
          can connect, chat, make audio and video calls, and share 24-hour
          status updates.
        </p>

        <div className="hero-buttons">
          <button className="btn-primary">Get Started</button>

          <button className="btn-secondary">Download App</button>
        </div>
      </section>
    </>
  );
}

export default Home;