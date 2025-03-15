import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  MessageSquare,
  FileText,
  Edit,
  Sparkles,
  Send,
  X,
  ArrowUp
} from 'lucide-react'
import { EditorBubbleItem, useEditor } from 'novel'
import type { SelectorItem } from './node-selector'
import Image from 'next/image'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWindowSize } from '@/lib/hooks/use-window-size'

export const TextButtons = () => {
  const { editor } = useEditor()
  const [isExpanded, setIsExpanded] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { width } = useWindowSize()
  
  useEffect(() => {
    // Focus the input when expanded
    if (isExpanded && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 300) // Increased delay to match slower animation
    }
  }, [isExpanded])
  
  // Reset expanded state when editor changes or loses focus
  useEffect(() => {
    if (!editor) return
    
    // Function to close the expanded state
    const resetExpandedState = () => {
      setIsExpanded(false)
      setPrompt('')
    }
    
    // Listen for blur events on the editor
    const handleBlur = () => {
      resetExpandedState()
    }
    
    // Listen for selection changes which indicate cursor movement
    const handleSelectionUpdate = () => {
      if (isExpanded) {
        resetExpandedState()
      }
    }
    
    // Add event listeners
    editor.on('blur', handleBlur)
    editor.on('selectionUpdate', handleSelectionUpdate)
    
    // Clean up event listeners
    return () => {
      editor.off('blur', handleBlur)
      editor.off('selectionUpdate', handleSelectionUpdate)
    }
  }, [editor, isExpanded])
  
  // Always reset to closed state when component mounts or editor changes
  useEffect(() => {
    setIsExpanded(false)
    setPrompt('')
  }, [editor])
  
  if (!editor) return null
  
  // Define AI action handlers
  const handleChatWithAI = () => {
    // Toggle expanded state only if not already expanded
    if (!isExpanded) {
      setIsExpanded(true)
    }
  }
  
  const handleSubmit = (e?: React.MouseEvent) => {
    // Prevent event propagation to avoid closing
    e?.stopPropagation()
    
    if (prompt.trim()) {
      // Show loading state
      setIsLoading(true)
      
      // Get selected text
      const selection = editor.state.selection
      const selectedText = selection.empty 
        ? '' 
        : editor.state.doc.textBetween(selection.from, selection.to)
      
      console.log("Chat with AI about:", selectedText, "Prompt:", prompt)
      // Implement chat with AI functionality
      
      // Simulate API call
      setTimeout(() => {
        setIsLoading(false)
        // Reset prompt after submission
        setPrompt('')
        setIsExpanded(false)
      }, 1000)
    }
  }
  
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsExpanded(false)
  }
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      setIsExpanded(false)
      setPrompt('')
    }
  }
  
  // Prevent clicks on the expanded input from closing it
  const handleExpandedClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }
  
  // Get appropriate width based on screen size
  const getInputWidth = () => {
    if (width < 640) return '100%'
    if (width < 768) return '300px'
    return '400px'
  }
  
  // Spring animation config for smoother, slower transitions
  const springConfig = {
    type: 'spring',
    stiffness: 250, // Even slower animation
    damping: 35,
    mass: 1.2,
    duration: 0.8
  }
  
  // Slower fade transition
  const fadeTransition = {
    duration: 0.4,
    ease: [0.22, 1, 0.36, 1] // Custom ease curve for smoother fade
  }
  
  // Define animation variants to ensure consistent timing between open and close
  const containerVariants = {
    initial: { 
      width: 32, 
      opacity: 0 
    },
    animate: { 
      width: getInputWidth(), 
      opacity: 1,
      transition: {
        width: springConfig,
        opacity: fadeTransition
      }
    },
    exit: { 
      width: 32, 
      opacity: 0,
      transition: {
        width: springConfig,
        opacity: fadeTransition
      }
    }
  }
  
  // Content animation variants
  const contentVariants = {
    initial: { opacity: 0 },
    animate: { 
      opacity: 1,
      transition: { 
        delay: 0.15,
        duration: 0.4,
        ease: "easeOut"
      }
    },
    exit: {
      opacity: 0,
      transition: {
        duration: 0.3,
        ease: "easeIn"
      }
    }
  }
  
  // Input animation variants
  const inputVariants = {
    initial: { y: 10, opacity: 0 },
    animate: { 
      y: 0, 
      opacity: 1,
      transition: { 
        delay: 0.3,
        duration: 0.4,
        ease: "easeOut"
      }
    },
    exit: {
      y: 10,
      opacity: 0,
      transition: {
        duration: 0.3,
        ease: "easeIn"
      }
    }
  }
  
  // Button animation variants
  const buttonVariants = {
    initial: { opacity: 0, scale: 0.8 },
    animate: { 
      opacity: 1, 
      scale: 1,
      transition: { 
        delay: 0.4,
        duration: 0.3,
        ease: "easeOut"
      }
    },
    exit: {
      opacity: 0,
      scale: 0.8,
      transition: {
        duration: 0.2,
        ease: "easeIn"
      }
    }
  }
  
  return (
    <div className='flex w-full justify-start'>
      <div className="relative inline-block" style={{ width: isExpanded ? getInputWidth() : '32px', height: '32px' }}>
        <EditorBubbleItem
          onSelect={handleChatWithAI}
          className="static"
        >
          <div className="absolute left-0 top-0 w-full h-full" ref={containerRef}>
            {/* Button state */}
            <div className="absolute left-0 top-0 z-10 h-8 w-8 flex items-center justify-center pointer-events-none">
              <Sparkles className='h-4 w-4 text-black dark:text-white' />
            </div>
            
            {/* Background circle - always visible */}
            <div className={`absolute left-0 top-0 rounded-full border dark:bg-black bg-white shadow-sm h-8 w-8 ${isExpanded ? 'opacity-0' : 'opacity-100'}`}></div>
            
            {/* Expanded state */}
            <AnimatePresence mode="wait">
              {isExpanded && (
                <motion.div 
                  variants={containerVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="absolute left-0 top-0 flex items-center dark:bg-black bg-white border rounded-full shadow-sm h-8 overflow-hidden"
                  onClick={handleExpandedClick}
                  style={{ transformOrigin: 'left center' }}
                >
                  {/* Empty space for the fixed icon */}
                  <div className="flex-shrink-0 h-8 w-8"></div>
                  
                  {/* Expanding content */}
                  <motion.div 
                    variants={contentVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="flex-grow overflow-hidden"
                  >
                    <motion.div
                      variants={inputVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                    >
                      <Input
                        ref={inputRef}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Ask Zero to help"
                        className="flex-grow h-8 text-sm bg-white dark:bg-black border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
                      />
                    </motion.div>
                  </motion.div>
                  
                  {/* Action buttons */}
                  <motion.div 
                    variants={buttonVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="flex items-center gap-1 pr-1 ml-1"
                  >
                    {isLoading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                        className="h-5 w-5 mr-1 text-black dark:text-white"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                        </svg>
                      </motion.div>
                    ) : (
                      <>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={handleClose}
                          className="h-6 w-6 p-0 rounded-full bg-transparent text-black dark:text-white hover:bg-transparent"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={handleSubmit}
                          className="h-6 w-6 p-0 rounded-full bg-transparent text-black dark:text-white hover:bg-transparent"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </EditorBubbleItem>
      </div>
    </div>
  )
}
