import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <span>
          <strong className="strong">StreetMeet</strong> · meet people around you
        </span>
        <nav className="row" style={{ gap: 16 }} aria-label="Footer">
          <Link to="/register">Create account</Link>
          <Link to="/login">Log in</Link>
          <Link to="/premium">Premium</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
        </nav>
        <span className="tiny">© {new Date().getFullYear()} StreetMeet</span>
      </div>
    </footer>
  )
}

export default Footer
