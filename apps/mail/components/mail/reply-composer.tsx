'use client';

import { type Dispatch, type SetStateAction, useRef, useState, useEffect, useCallback } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { UploadedFileIcon } from '@/components/create/uploaded-file-icon';
import { ArrowUp, Paperclip, Reply, X, Plus, Sparkles, Check, X as XIcon } from 'lucide-react';
import { cleanEmailAddress, truncateFileName } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import Editor from '@/components/create/editor';
import { Button } from '@/components/ui/button';
import type { ParsedMessage } from '@/types';
import { useTranslations } from 'next-intl';
import { sendEmail } from '@/actions/send';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { JSONContent } from 'novel';

interface ReplyComposeProps {
  emailData: ParsedMessage[];
  isOpen?: boolean;
  setIsOpen?: Dispatch<SetStateAction<boolean>>;
}

export default function ReplyCompose({ emailData, isOpen, setIsOpen }: ReplyComposeProps) {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [messageContent, setMessageContent] = useState('');
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  const [editorHeight, setEditorHeight] = useState(150); // Initial height 150px
  const [isResizing, setIsResizing] = useState(false);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [showAIOptions, setShowAIOptions] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [editorInitialValue, setEditorInitialValue] = useState<JSONContent | undefined>(undefined);
  const resizeStartY = useRef(0);
  const startHeight = useRef(0);
  const composerRef = useRef<HTMLFormElement>(null);
  const t = useTranslations();

  // Use external state if provided, otherwise use internal state
  const composerIsOpen = isOpen !== undefined ? isOpen : isComposerOpen;
  const setComposerIsOpen = (value: boolean) => {
    if (setIsOpen) {
      setIsOpen(value);
    } else {
      setIsComposerOpen(value);
    }
  };

  // Handle keyboard shortcuts for sending email
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Check for Cmd/Ctrl + Enter
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (isFormValid) {
        void handleSendEmail(e as unknown as React.MouseEvent<HTMLButtonElement>);
      }
    }
  };

  const handleAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setIsUploading(true);
      try {
        await new Promise((resolve) => setTimeout(resolve, 500));
        setAttachments([...attachments, ...Array.from(e.target.files)]);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!e.target || !(e.target as HTMLElement).closest('.ProseMirror')) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.target || !(e.target as HTMLElement).closest('.ProseMirror')) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!e.target || !(e.target as HTMLElement).closest('.ProseMirror')) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        setAttachments([...attachments, ...Array.from(e.dataTransfer.files)]);
        // Open the composer if it's not already open
        if (!composerIsOpen) {
          setComposerIsOpen(true);
        }
      }
    }
  };

  const constructReplyBody = (
    formattedMessage: string,
    originalDate: string,
    originalSender: { name?: string; email?: string } | undefined,
    cleanedToEmail: string,
    quotedMessage?: string,
  ) => {
    return `
      <div style="font-family: Arial, sans-serif;">
        <div style="margin-bottom: 20px;">
          ${formattedMessage}
        </div>
        <div style="padding-left: 1em; margin-top: 1em; border-left: 2px solid #ccc; color: #666;">
          <div style="margin-bottom: 1em;">
            On ${originalDate}, ${originalSender?.name ? `${originalSender.name} ` : ''}${originalSender?.email ? `&lt;${cleanedToEmail}&gt;` : ''} wrote:
          </div>
          <div style="white-space: pre-wrap;">
            ${quotedMessage}
          </div>
        </div>
      </div>
    `;
  };

  const handleSendEmail = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try {
      const originalSubject = emailData[0]?.subject || '';
      const subject = originalSubject.startsWith('Re:')
        ? originalSubject
        : `Re: ${originalSubject}`;

      const originalSender = emailData[0]?.sender;
      const cleanedToEmail = cleanEmailAddress(emailData[emailData.length - 1]?.sender?.email);
      const originalDate = new Date(emailData[0]?.receivedOn || '').toLocaleString();
      const quotedMessage = emailData[0]?.decodedBody;
      const messageId = emailData[0]?.messageId;
      const threadId = emailData[0]?.threadId;

      const formattedMessage = messageContent;

      const replyBody = constructReplyBody(
        formattedMessage,
        originalDate,
        originalSender,
        cleanedToEmail,
        quotedMessage,
      );

      const inReplyTo = messageId;

      const existingRefs = emailData[0]?.references?.split(' ') || [];
      const references = [...existingRefs, emailData[0]?.inReplyTo, cleanEmailAddress(messageId)]
        .filter(Boolean)
        .join(' ');

      await sendEmail({
        to: cleanedToEmail,
        subject,
        message: replyBody,
        attachments,
        headers: {
          'In-Reply-To': inReplyTo ?? '',
          References: references,
          'Thread-Id': threadId ?? '',
        },
      });

      setMessageContent('');
      setComposerIsOpen(false);
      toast.success(t('pages.createEmail.emailSentSuccessfully'));
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error(t('pages.createEmail.failedToSendEmail'));
    }
  };

  const toggleComposer = () => {
    setComposerIsOpen(!composerIsOpen);
    if (!composerIsOpen) {
      // Focus will be handled by the useEffect below
    }
  };

  // Add a useEffect to focus the editor when the composer opens
  useEffect(() => {
    if (composerIsOpen) {
      // Give the editor time to render before focusing
      const timer = setTimeout(() => {
        // Focus the editor - Novel editor typically has a ProseMirror element
        const editorElement = document.querySelector('.ProseMirror');
        if (editorElement instanceof HTMLElement) {
          editorElement.focus();
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [composerIsOpen]);

  // Handle dynamic resizing
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isResizing) {
        e.preventDefault();
        // Invert the delta so dragging up grows the editor and dragging down shrinks it
        const deltaY = resizeStartY.current - e.clientY;
        let newHeight = Math.max(100, Math.min(500, startHeight.current + deltaY));
        
        // Ensure height stays within bounds
        newHeight = Math.max(100, Math.min(500, newHeight));
        setEditorHeight(newHeight);
      }
    },
    [isResizing]
  );

  const handleMouseUp = useCallback(() => {
    if (isResizing) {
      setIsResizing(false);
    }
  }, [isResizing]);

  // Set up and clean up event listeners for resizing
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Auto-grow effect when typing
  useEffect(() => {
    if (composerIsOpen) {
      const editorElement = document.querySelector('.ProseMirror');
      if (editorElement instanceof HTMLElement) {
        // Observer to watch for content changes and adjust height
        const resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const contentHeight = entry.contentRect.height;
            
            // If content exceeds current height but is less than max, grow the container
            if (contentHeight > editorHeight - 20 && editorHeight < 500) {
              const newHeight = Math.min(500, contentHeight + 20);
              setEditorHeight(newHeight);
            }
          }
        });
        
        resizeObserver.observe(editorElement);
        return () => resizeObserver.disconnect();
      }
    }
  }, [composerIsOpen, editorHeight]);

  // Check if the message is empty
  const isMessageEmpty =
    !messageContent ||
    messageContent ===
      JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [],
          },
        ],
      });

  // Check if form is valid for submission
  const isFormValid = !isMessageEmpty || attachments.length > 0;

  const createAIJsonContent = (text: string): JSONContent => {
    // Try to identify common sign-off patterns with a more comprehensive regex
    const signOffPatterns = [
      /\b((?:Best regards|Regards|Sincerely|Thanks|Thank you|Cheers|Best|All the best|Yours truly|Yours sincerely|Cordially)(?:,)?)\s*\n+\s*([A-Za-z][A-Za-z\s.]*)$/i
    ];
    
    let mainContent = text;
    let signatureLines: string[] = [];
    
    // Extract sign-off if found
    for (const pattern of signOffPatterns) {
      const match = text.match(pattern);
      if (match) {
        // Find the index where the sign-off starts
        const signOffIndex = text.lastIndexOf(match[0]);
        if (signOffIndex > 0) {
          // Split the content
          mainContent = text.substring(0, signOffIndex).trim();
          
          // Split the signature part into separate lines
          const signature = text.substring(signOffIndex).trim();
          signatureLines = signature.split(/\n+/).map(line => line.trim()).filter(Boolean);
          break;
        }
      }
    }
    
    // If no signature was found with regex but there are newlines at the end,
    // check if the last lines could be a signature
    if (signatureLines.length === 0) {
      const allLines = text.split(/\n+/);
      if (allLines.length > 1) {
        // Check if last 1-3 lines might be a signature (short lines at the end)
        const potentialSigLines = allLines.slice(-3).filter(line => 
          line.trim().length < 60 && 
          !line.trim().endsWith('?') && 
          !line.trim().endsWith('.')
        );
        
        if (potentialSigLines.length > 0) {
          signatureLines = potentialSigLines;
          mainContent = allLines.slice(0, allLines.length - potentialSigLines.length).join('\n').trim();
        }
      }
    }
    
    // Split the main content into paragraphs
    const paragraphs = mainContent.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    
    if (paragraphs.length === 0 && signatureLines.length === 0) {
      // If no paragraphs and no signature were found, treat the whole text as one paragraph
      paragraphs.push(text);
    }
    
    // Create a content array with appropriate spacing between paragraphs
    const content = [];
    
    paragraphs.forEach((paragraph, index) => {
      // Add the content paragraph
      content.push({
        type: "paragraph",
        content: [{ type: "text", text: paragraph }]
      });
      
      // Add an empty paragraph between main paragraphs
      if (index < paragraphs.length - 1) {
        content.push({
          type: "paragraph"
        });
      }
    });
    
    // If we found a signature, add it with proper spacing
    if (signatureLines.length > 0) {
      // Add spacing before the signature if there was content
      if (paragraphs.length > 0) {
        content.push({
          type: "paragraph"
        });
      }
      
      // Add each line of the signature as a separate paragraph
      signatureLines.forEach(line => {
        content.push({
          type: "paragraph",
          content: [{ type: "text", text: line }]
        });
      });
    }
    
    return {
      type: "doc",
      content: content
    };
  };

  const generateAIResponse = async (): Promise<string> => {
    try {
      // Extract relevant information from the email thread for context
      const latestEmail = emailData[emailData.length - 1];
      const originalSender = latestEmail?.sender?.name || 'the recipient';
      
      // Create a summary of the thread content for context
      const threadContent = emailData
        .map((email) => {
          return `
From: ${email.sender?.name || 'Unknown'} <${email.sender?.email || 'unknown@email.com'}>
Subject: ${email.subject || 'No Subject'}
Date: ${new Date(email.receivedOn || '').toLocaleString()}

${email.decodedBody || 'No content'}
          `;
        })
        .join('\n---\n');
    
      
      // Call the AI API endpoint
      const response = await fetch('/api/ai-reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          threadContent,
          originalSender,
        }),
      });
      
      // Store the response data
      const responseData = await response.json();

      console.log(responseData);
      
      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to generate AI response');
      }
      
      return responseData.reply;
    } catch (error) {
      console.error('Error generating AI response:', error);
      throw error;
    }
  };

  const handleAIButtonClick = async () => {
    setIsLoadingAI(true);
    try {
      const suggestion = await generateAIResponse();
      setAiSuggestion(suggestion);

      setEditorInitialValue(createAIJsonContent(suggestion));

      setEditorKey(prevKey => prevKey + 1);
      setShowAIOptions(true);
      toast.success('AI reply generated! Review and edit before sending.');
    } catch (error: any) {
      console.error('Error generating AI response:', error);
      
      // Show a more helpful error message
      let errorMessage = 'Failed to generate AI response. Please try again or compose manually.';
      
      if (error.message) {
        if (error.message.includes('OpenAI API')) {
          errorMessage = 'AI service is currently unavailable. Please try again later.';
        } else if (error.message.includes('key is not configured')) {
          errorMessage = 'AI service is not properly configured. Please contact support.';
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setIsLoadingAI(false);
    }
  };

  const acceptAISuggestion = () => {
    if (aiSuggestion) {
      // Use the improved content creator to generate proper JSON structure
      const jsonContent = createAIJsonContent(aiSuggestion);
      
      // Convert the JSON content to HTML
      const htmlContent = convertJSONToHTML(jsonContent);
      
      // Set the HTML content as the message content
      setMessageContent(htmlContent);
      
      // Reset AI state
      setEditorInitialValue(undefined);
      resetAIState();
    }
  };

  // Helper function to convert JSON content to HTML
  const convertJSONToHTML = (jsonContent: JSONContent): string => {
    let html = '';
    
    if (jsonContent.type === 'doc' && jsonContent.content) {
      jsonContent.content.forEach(node => {
        if (node.type === 'paragraph') {
          if (!node.content || node.content.length === 0) {
            // Empty paragraph
            html += '<p><br></p>';
          } else {
            // Paragraph with content
            html += '<p>';
            node.content.forEach(inline => {
              if (inline.type === 'text') {
                html += inline.text || '';
              }
              // Handle other inline types if needed (bold, italic, etc.)
            });
            html += '</p>';
          }
        }
        // Handle other block types if needed
      });
    }
    
    return html;
  };

  const rejectAISuggestion = () => {
    setEditorInitialValue(undefined);
    setEditorKey(prevKey => prevKey + 1);
    resetAIState();
  };

  const resetAIState = () => {
    setAiSuggestion(null);
    setShowAIOptions(false);
  };

  if (!composerIsOpen) {
    return (
      <div className="bg-offsetLight dark:bg-offsetDark w-full p-2">
        <Button
          onClick={toggleComposer}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-md"
          variant="outline"
        >
          <Reply className="h-4 w-4" />
          <span>
            {t('common.replyCompose.replyTo')}{' '}
            {emailData[emailData.length - 1]?.sender?.name || t('common.replyCompose.thisEmail')}
          </span>
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-offsetLight dark:bg-offsetDark w-full p-2">
      <form
        ref={composerRef}
        className={cn(
          'border-border ring-offset-background flex h-fit flex-col space-y-2.5 rounded-[10px] border px-2 py-2 transition-shadow duration-300 ease-in-out',
          isEditorFocused ? 'ring-2 ring-[#3D3D3D] ring-offset-1' : '',
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onSubmit={(e) => {
          // Prevent default form submission
          e.preventDefault();
        }}
        onKeyDown={handleKeyDown}
      >
        {isDragging && (
          <div className="bg-background/80 border-primary/30 absolute inset-0 z-50 m-4 flex items-center justify-center rounded-2xl border-2 border-dashed backdrop-blur-sm">
            <div className="text-muted-foreground flex flex-col items-center gap-2">
              <Paperclip className="text-muted-foreground h-12 w-12" />
              <p className="text-lg font-medium">{t('common.replyCompose.dropFiles')}</p>
            </div>
          </div>
        )}

        <div className="text-muted-foreground flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Reply className="h-4 w-4" />
            <p className="truncate">
              {emailData[emailData.length - 1]?.sender?.name} (
              {emailData[emailData.length - 1]?.sender?.email})
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.preventDefault();
              toggleComposer();
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Resize handle at the top */}
        <div 
          className="w-full h-2 cursor-ns-resize flex justify-center items-center transition-colors"
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
            resizeStartY.current = e.clientY;
            startHeight.current = editorHeight;
          }}
        >
          <div className="w-10 h-1 rounded-full dark:bg-white bg-black" />
        </div>
        
        {showAIOptions && (
          <div className="flex items-center gap-2 px-2 py-1 bg-blue-50 dark:bg-blue-950 rounded-md text-xs">
            <Sparkles className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-blue-700 dark:text-blue-300">AI-generated reply suggestion. Review and edit before sending.</span>
          </div>
        )}

        <div 
          className="w-full flex-grow overflow-hidden p-1"
          style={{ 
            height: `${editorHeight}px`,
            maxHeight: '500px',
            transition: isResizing ? 'none' : 'height 0.1s ease-out'
          }}
        >
          <div
            className="h-full w-full overflow-y-auto"
            onDragOver={(e) => e.stopPropagation()}
            onDragLeave={(e) => e.stopPropagation()}
            onDrop={(e) => e.stopPropagation()}
          >
            <Editor
              key={editorKey}
              onChange={(content) => {
                setMessageContent(content);
              }}
              initialValue={editorInitialValue}
              className={cn(
                "sm:max-w-[600px] md:max-w-[2050px]",
                showAIOptions ? "border border-blue-200 dark:border-blue-800 rounded-md bg-blue-50/30 dark:bg-blue-950/30 p-1" : ""
              )}
              placeholder={showAIOptions ? "AI-generated reply (you can edit)" : "Type your reply here..."}
              onFocus={() => {
                setIsEditorFocused(true);
              }}
              onBlur={() => {
                setIsEditorFocused(false);
              }}
            />
          </div>
        </div>


        <div className="mt-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="group relative w-9 overflow-hidden transition-all duration-200 hover:w-32"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('attachment-input')?.click();
              }}
            >
              <Plus className="absolute left-[9px] h-6 w-6" />
              <span className="whitespace-nowrap pl-7 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                {t('common.replyCompose.attachments')}
              </span>
            </Button>
            
            {!showAIOptions ? (
              <Button 
                variant="outline" 
                className="group relative w-9 overflow-hidden transition-all duration-200 hover:w-40"
                onClick={(e) => {
                  e.preventDefault();
                  void handleAIButtonClick();
                }}
                disabled={isLoadingAI}
              >
                {isLoadingAI ? (
                  <div className="absolute left-[9px] h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                ) : (
                  <Sparkles className="absolute left-[9px] h-6 w-6" />
                )}
                <span className="whitespace-nowrap pl-7 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  {isLoadingAI ? "Generating..." : "AI Draft Reply"}
                </span>
              </Button>
            ) : (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={(e) => {
                    e.preventDefault();
                    acceptAISuggestion();
                    toast.success('AI reply accepted');
                  }}
                >
                  <Check className="h-5 w-5 text-green-500" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={(e) => {
                    e.preventDefault();
                    rejectAISuggestion();
                    toast.info('AI reply discarded');
                  }}
                >
                  <XIcon className="h-5 w-5 text-red-500" />
                </Button>
              </div>
            )}

            {attachments.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    <span>
                      {attachments.length}{' '}
                      {t('common.replyCompose.attachmentCount', { count: attachments.length })}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 touch-auto" align="start">
                  <div className="space-y-2">
                    <div className="px-1">
                      <h4 className="font-medium leading-none">
                        {t('common.replyCompose.attachments')}
                      </h4>
                      <p className="text-muted-foreground text-sm">
                        {attachments.length}{' '}
                        {t('common.replyCompose.fileCount', { count: attachments.length })}
                      </p>
                    </div>
                    <Separator />
                    <div className="h-[300px] touch-auto overflow-y-auto overscroll-contain px-1 py-1">
                      <div className="grid grid-cols-2 gap-2">
                        {attachments.map((file, index) => (
                          <div
                            key={index}
                            className="group relative overflow-hidden rounded-md border"
                          >
                            <UploadedFileIcon
                              removeAttachment={removeAttachment}
                              index={index}
                              file={file}
                            />
                            <div className="bg-muted/10 p-2">
                              <p className="text-xs font-medium">
                                {truncateFileName(file.name, 20)}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                {(file.size / (1024 * 1024)).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <input
              type="file"
              id="attachment-input"
              className="hidden"
              onChange={handleAttachment}
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            />
          </div>
          <div className="mr-2 flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8">
              {t('common.replyCompose.saveDraft')}
            </Button>
            <Button
              size="sm"
              className="group relative h-8 w-9 overflow-hidden transition-all duration-200 hover:w-24"
              onClick={async (e) => {
                e.preventDefault();
                await handleSendEmail(e);
              }}
              disabled={!isFormValid}
              type="button"
            >
              <span className="whitespace-nowrap pr-7 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                {t('common.replyCompose.send')}
              </span>
              <ArrowUp className="absolute right-2.5 h-4 w-4" />
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
