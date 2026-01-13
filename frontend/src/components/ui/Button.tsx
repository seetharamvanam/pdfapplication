import React from 'react'
import { motion } from 'framer-motion'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'secondary'
}

export default function Button({ variant = 'primary', className = '', children, ...rest }: Props) {
  const baseClass = 'btn-enterprise'
  const variantClass = variant === 'primary' ? 'primary' : variant === 'ghost' ? 'ghost' : 'secondary'
  const cls = `${baseClass} ${variantClass} ${className}`

  return (
    <motion.button
      whileHover={{ scale: 1.02, translateY: -1 }}
      whileTap={{ scale: 0.98 }}
      className={cls}
      {...(rest as any)}
    >
      {children}
    </motion.button>
  )
}
