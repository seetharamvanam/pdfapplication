import Home from './Home'
import Merge from './Merge'
import Split from './Split'
import Compress from './Compress'
import Convert from './Convert'
import Secure from './Secure'
import View from './View'
import Edit from './Edit'
import Advanced from './Advanced'
import Create from './Create'
import Annotate from './Annotate'
import Organize from './Organize'
import Forms from './Forms'
import OCR from './OCR'
import Utilities from './Utilities'
import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import PageTransition from '../components/ui/PageTransition'

const ROUTES: Record<string, React.FC> = {
  '': Home,
  '#': Home,
  '#home': Home,
  '#view': View,
  '#create': Create,
  '#edit': Edit,
  '#annotate': Annotate,
  '#convert': Convert,
  '#ocr': OCR,
  '#merge': Merge,
  '#split': Split,
  '#organize': Organize,
  '#secure': Secure,
  '#forms': Forms,
  '#compress': Compress,
  '#utilities': Utilities,
  '#advanced': Advanced,
}

export default function Router() {
  const [hash, setHash] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.hash || '#'
    }
    return '#'
  })

  useEffect(() => {
    function onHash() { 
      setHash(window.location.hash || '#') 
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const Page = ROUTES[hash] || Home

  return (
    <AnimatePresence mode="wait">
      <PageTransition key={hash}>
        <Page />
      </PageTransition>
    </AnimatePresence>
  )
}
