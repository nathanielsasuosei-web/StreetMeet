import Navbar from "../components/Navbar";

function Home() {
  return (
    <>
      <Navbar />

      <div style={{ padding: "60px", textAlign: "center" }}>
        <h1>Welcome to Street Meet ❤️</h1>

        <p>
          Meet new people, chat instantly, share your status,
          and make meaningful connections.
        </p>

        <button
          style={{
            padding: "15px 30px",
            fontSize: "18px",
            background: "#22c55e",
            color: "white",
            border: "none",
            borderRadius: "8px",
          }}
        >
          Start Matching
        </button>
      </div>
    </>
  );
}

export default Home;