import {
	type Dispatch,
	type SetStateAction,
	useRef,
	useState,
	useEffect,
	useCallback,
} from 'react';
import { ArrowUp, Paperclip, Reply, X, Plus, Sparkles } from 'lucide-react';
import { cleanEmailAddress, truncateFileName } from '@/lib/utils';
import Editor from '@/components/create/editor';
import { Button } from '@/components/ui/button';
import { formatThreadContext } from '@/lib/ai';
import type { ParsedMessage } from '@/types';
import { useTranslations } from 'next-intl';
import { sendEmail } from '@/actions/send';
import { type JSONContent } from 'novel';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ReplyComposeProps {
	emailData: ParsedMessage[];
	isOpen?: boolean;
	setIsOpen?: Dispatch<SetStateAction<boolean>>;
}

export default function ReplyCompose({ emailData, isOpen, setIsOpen }: ReplyComposeProps) {
	const editorRef = useRef<HTMLTextAreaElement>(null);
	const [attachments, setAttachments] = useState<File[]>([]);
	const [isUploading, setIsUploading] = useState(false);
	const [messageContent, setMessageContent] = useState<string | JSONContent>('');
	const [isComposerOpen, setIsComposerOpen] = useState(false);
	const [isDragging, setIsDragging] = useState(false);
	const [isEditorFocused, setIsEditorFocused] = useState(false);
	const [aiSuggestion, setAiSuggestion] = useState('');
	const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);
	// State to track editor content height
	const [editorHeight, setEditorHeight] = useState(500); // Default height
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

	// Reset editor height when composer is opened
	useEffect(() => {
		if (composerIsOpen) {
			setEditorHeight(500); // Reset to default height
		}
	}, [composerIsOpen]);

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
		formattedMessage: string | JSONContent,
		originalDate: string,
		originalSender: { name?: string; email?: string } | undefined,
		cleanedToEmail: string,
		quotedMessage?: string,
	) => {
		// Convert JSONContent to string if needed
		const messageStr =
			typeof formattedMessage === 'string' ? formattedMessage : JSON.stringify(formattedMessage);
		return `
      <div style="font-family: Arial, sans-serif;">
        <div style="margin-bottom: 20px;">
          ${messageStr}
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

	// Track aiSuggestion changes
	useEffect(() => {
		console.log('aiSuggestion state changed:', aiSuggestion);
	}, [aiSuggestion]);

	// Function to get AI suggestion
	const handleGetAISuggestion = useCallback(async () => {
		if (isLoadingSuggestion) return;

		setIsLoadingSuggestion(true);
		setAiSuggestion('');

		try {
			// Format the thread context for better AI understanding
			const threadContext = formatThreadContext(emailData);

			// Prepare recipients information
			const recipients = emailData[emailData.length - 1]?.sender?.email
				? [emailData[emailData.length - 1]?.sender?.email]
				: [];

			// Call the AI suggestion API
			const response = await fetch('/api/ai/suggest', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					prompt: 'Suggest a brief, professional reply to this email thread.',
					threadContext,
					emailContent: messageContent,
					recipients,
				}),
			});

			if (!response.ok) {
				throw new Error('Failed to get AI suggestion');
			}

			const data = await response.json();

			if (data.success && data.content) {
				// Find the editor element
				const editorElement = document.querySelector('.ProseMirror');
				if (editorElement instanceof HTMLElement) {
					// Clean up the content - remove Subject line and fix spacing
					let cleanedContent = data.content;

					// Log the raw content for debugging
					console.log('Raw content from API:', JSON.stringify(cleanedContent));

					// Pre-process the content to fix common formatting issues
					// Fix broken apostrophes that might cause line breaks
					cleanedContent = cleanedContent.replace(/([A-Za-z])\s*'\s*([A-Za-z])/g, "$1'$2");

					// Remove any Subject line completely (including any variations)
					cleanedContent = cleanedContent.replace(/^Subject:.*?\n/i, '');

					// We'll preserve the original formatting from the API exactly as it comes in
					// Only remove the Subject line if present, otherwise keep everything intact

					// Special handling for signature lines (Best, Name or similar)
					const signatureRegex =
						/(Best[,.]|Regards[,.]|Sincerely[,.]|Thanks[,.]|Thank you[,.]|Cheers[,.]|Best regards[,.])[\s\n]+(\w+)[\s\n]*$/i;
					const hasSignature = signatureRegex.test(cleanedContent);

					// If there's a signature, save it for later
					let signature = '';
					if (hasSignature) {
						signature = cleanedContent.match(signatureRegex)?.[0] || '';
						signature = signature.trim();
						cleanedContent = cleanedContent.replace(signatureRegex, '');
					}

					// Clean up the main content
					cleanedContent = cleanedContent.trim();

					// Format the content as a single paragraph with signature at the end
					let formattedContent = '';

					// Start with an empty formatted content string
					formattedContent = '';

					// Preserve the original content structure from the API
					// No need to process the content line by line

					// Split by double newlines to get paragraphs, preserving the original structure
					const paragraphs = cleanedContent.split(/\n\s*\n/).filter((p) => p.trim() !== '');

					// Log the paragraphs for debugging
					console.log('Paragraphs after splitting:', paragraphs);

					// Convert the content directly to HTML paragraphs with proper spacing
					// First, split the content by single newlines to get all lines
					const contentLines = cleanedContent
						.split(/\n/)
						.filter((line: string) => line.trim() !== '');

					// Process the lines to create paragraphs with proper spacing
					formattedContent = '';

					// Handle the greeting separately (first line)
					if (contentLines.length > 0) {
						// Add the greeting as its own paragraph
						formattedContent += '<p>' + contentLines[0].trim() + '</p>';

						// Add an empty paragraph after the greeting for spacing
						formattedContent += '<p><br></p>';

						// Process the remaining lines as paragraphs
						for (let i = 1; i < contentLines.length; i++) {
							// Add each line as a paragraph
							formattedContent += '<p>' + contentLines[i].trim() + '</p>';

							// Add an empty paragraph between content paragraphs for spacing
							if (i < contentLines.length - 1) {
								formattedContent += '<p><br></p>';
							}
						}
					}

					// Add signature with proper spacing according to Tiptap docs
					if (signature) {
						// Add an empty paragraph for spacing before the signature
						formattedContent += '<p><br></p>';

						// Split the signature into lines
						const signatureLines = signature.split(/\n/);

						// Add the signature closing (e.g., "Best,")
						if (signatureLines.length > 0) {
							formattedContent += '<p>' + signatureLines[0].trim() + '</p>';
						}

						// Add the name on a separate line
						if (signatureLines.length > 1) {
							formattedContent += '<p>' + signatureLines[1].trim() + '</p>';
						}
					}

					// Set the final content
					cleanedContent = formattedContent;

					// Log the final formatted content for debugging
					console.log('Final formatted HTML content:', formattedContent);

					// Set the content in the editor using proper Tiptap HTML format
					// This ensures the editor properly renders paragraphs with correct spacing
					editorElement.innerHTML = formattedContent;

					// Focus the editor
					editorElement.focus();

					// Show success message
					toast.success('AI content applied');
				} else {
					console.error('Could not find editor element');
					toast.error('Could not apply AI content');
				}
			} else {
				console.error('AI suggestion error:', data.error || 'No error message provided');
				throw new Error(data.error || 'Failed to generate suggestion');
			}
		} catch (error) {
			console.error('Error getting AI suggestion:', error);
			toast.error('Failed to generate AI suggestion');
		} finally {
			setIsLoadingSuggestion(false);
		}
	}, [emailData, messageContent, t]);

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
				className={cn(
					`border-border ring-offset-background flex flex-col space-y-2.5 rounded-[10px] border px-2 py-2 transition-all duration-300 ease-in-out`,
					isEditorFocused ? 'ring-2 ring-[#3D3D3D] ring-offset-1' : '',
				)}
				style={{ minHeight: '300px' }}
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

				<div
					className="w-full flex-grow p-1"
					style={{ maxHeight: `${Math.min(editorHeight - 100, 500)}px`, overflowY: 'auto' }}
				>
					<div
						className="w-full"
						onDragOver={(e) => e.stopPropagation()}
						onDragLeave={(e) => e.stopPropagation()}
						onDrop={(e) => e.stopPropagation()}
					>
						{/* Render Editor with messageContent */}
						{(() => {
							console.log('Rendering Editor with messageContent:', messageContent);
							return null;
						})()}
						<Editor
							onChange={(content) => {
								setMessageContent(content);

								// Calculate editor height after content changes
								setTimeout(() => {
									const editorElement = document.querySelector('.ProseMirror');
									if (editorElement) {
										// Get content height + some padding
										const contentHeight = editorElement.scrollHeight;
										// Add extra space for header and footer (adjust as needed)
										const totalHeight = contentHeight + 120;
										// Update height state (minimum 300px)
										setEditorHeight(Math.max(300, totalHeight));
									}
								}, 0);
							}}
							className="sm:max-w-[600px] md:max-w-[2050px]"
							initialValue={{
								type: 'doc',
								content: [
									{
										type: 'paragraph',
										content: [],
									},
								],
							}}
							placeholder="Type your reply here..."
							onFocus={() => {
								setIsEditorFocused(true);
							}}
							onBlur={() => {
								console.log('Editor blurred');
								setIsEditorFocused(false);
							}}
							aiSuggestion={aiSuggestion}
						/>
					</div>
				</div>

				<div className="sticky bottom-0 flex items-center justify-between bg-transparent pt-2">
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							className="group relative flex items-center gap-1 transition-all duration-200"
							onClick={handleGetAISuggestion}
							disabled={isLoadingSuggestion}
						>
							<Sparkles className="h-4 w-4" />
							<span className="whitespace-nowrap">
								{isLoadingSuggestion ? 'Generating...' : 'AI Suggest'}
							</span>
						</Button>
					</div>

					<div className="mr-2 flex items-center gap-2">
						<Button variant="ghost" size="sm" className="h-8 border">
							{t('common.replyCompose.saveDraft')}
						</Button>
						<Button
							size="sm"
							className="group relative h-9 w-9 rounded-full"
							onClick={async (e) => {
								e.preventDefault();
								await handleSendEmail(e);
							}}
							disabled={!isFormValid}
							type="button"
						>
							<ArrowUp className="absolute right-2.5 h-4 w-4" />
						</Button>
					</div>
				</div>
			</form>
		</div>
	);
}
