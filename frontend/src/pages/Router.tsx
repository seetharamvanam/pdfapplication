import Home from './Home'
import Merge from './Merge'
import Split from './Split'
import Compress from './Compress'
import Convert from './Convert'
import Secure from './Secure'
import View from './View'
import { useEffect, useState } from 'react'

const ROUTES: Record<string, React.FC> = {
  '': Home,
  '#': Home,
  '#home': Home,
  '#merge': Merge,
  '#split': Split,
  '#compress': Compress,
  '#convert': Convert,
  '#secure': Secure,
  '#view': View,
}

export default function Router() {
  const [hash, setHash] = useState<string>(() => window.location.hash || '#')

  useEffect(() => {
    function onHash() { setHash(window.location.hash || '#') }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const Page = ROUTES[hash] || Home
  return <Page />
}
