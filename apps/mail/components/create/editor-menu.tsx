import { EditorBubble, useEditor } from 'novel'
import { removeAIHighlight } from 'novel'
import { type ReactNode, useEffect, useState, useCallback } from 'react'
import { useWindowSize } from '@/lib/hooks/use-window-size'

interface EditorMenuProps {
  children: ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function EditorMenu({
  children,
  open,
  onOpenChange
}: EditorMenuProps) {
  const { editor } = useEditor()
  const { width } = useWindowSize()
  const [mounted, setMounted] = useState(false)

  // Handle window resize for responsive positioning
  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  useEffect(() => {
    if (!editor) return
    if (!open) removeAIHighlight(editor)
  }, [open])

  // Calculate max width based on screen size
  const getMaxWidth = useCallback(() => {
    if (!mounted) return '90vw'
    if (width < 640) return '85vw'
    if (width < 768) return '75vw'
    return '400px'
  }, [mounted, width])

  // Calculate placement based on screen size
  const getPlacement = useCallback(() => {
    if (width < 640) return 'top'
    return 'top-start' // Use top-start to align to the top-left
  }, [width])

  return (
    <EditorBubble
      tippyOptions={{
        placement: getPlacement(),
        onHidden: () => {
          onOpenChange(false)
          editor?.chain().unsetHighlight().run()
        },
        animation: false, // Disable tippy animation as we'll use framer-motion
        appendTo: () => document.body, // Append to body for better positioning
        zIndex: 50,
        duration: 0, // Disable duration for instant positioning
        offset: [-15, 3], // Move 20px more to the left and 10px above
        popperOptions: {
          modifiers: [
            {
              name: 'preventOverflow',
              options: {
                padding: 8,
                boundary: 'viewport',
              },
            },
            {
              name: 'computeStyles',
              options: {
                adaptive: true,
                gpuAcceleration: true
              }
            },
            {
              name: 'flip',
              options: {
                fallbackPlacements: ['bottom-start', 'bottom', 'top'], // Prefer top-left positions
              }
            }
          ],
        },
      }}
      className='overflow-visible'
    >
      {children}
    </EditorBubble>
  )
}
