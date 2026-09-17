import { Navigate } from 'react-router-dom'

/** /messages was the module-1 placeholder: conversations live under /matches now. */
export function Messages() {
  return <Navigate to="/matches" replace />
}

export default Messages
