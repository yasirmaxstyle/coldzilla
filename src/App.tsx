import type React from "react"
import { lazy, Suspense } from "react"


const LazyColdzillaScene = lazy(() => import("./components/godzilla/Scene"))
const App: React.FC = () => {
  return (
    <div className="container">
      <Suspense fallback={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-h)', fontSize: '1.2rem', fontWeight: 500, letterSpacing: '0.5px' }}>
          Loading scene...
        </div>
      }>
        <LazyColdzillaScene />
      </Suspense>
    </div>
  )
}

export default App
