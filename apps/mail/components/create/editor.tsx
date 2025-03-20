'use client';

import {
	Bold,
	Italic,
	Strikethrough,
	Underline,
	Link as LinkIcon,
	List,
	ListOrdered,
	Heading1,
	Heading2,
	Heading3,
	Paperclip,
	Plus,
	X,
} from 'lucide-react';
import {
	EditorCommand,
	EditorCommandEmpty,
	EditorCommandItem,
	EditorCommandList,
	EditorContent,
	EditorRoot,
	useEditor,
	type JSONContent,
} from 'novel';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Editor as TiptapEditor, useCurrentEditor } from '@tiptap/react';
import { suggestionItems } from '@/components/create/slash-command';
import { defaultExtensions } from '@/components/create/extensions';
import { ImageResizer, handleCommandNavigation } from 'novel';
import { uploadFn } from '@/components/create/image-upload';
import { handleImageDrop, handleImagePaste } from 'novel';
import EditorMenu from '@/components/create/editor-menu';
import Placeholder from '@tiptap/extension-placeholder';
import { UploadedFileIcon } from './uploaded-file-icon';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { truncateFileName } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Markdown } from 'tiptap-markdown';
import { useReducer, useRef } from 'react';
import { useState } from 'react';
import React from 'react';

// Fix the extensions type error by using a type assertion
const extensions = [...defaultExtensions, Markdown] as any[];

export const defaultEditorContent = {
	type: 'doc',
	content: [
		{
			type: 'paragraph',
			content: [],
		},
	],
};

interface EditorProps {
	initialValue?: JSONContent;
	onChange: (content: string) => void;
	placeholder?: string;
	onFocus?: () => void;
	onBlur?: () => void;
	className?: string;
	onCommandEnter?: () => void;
	onAttachmentsChange?: (attachments: File[]) => void;
	aiSuggestion?: string; // Added prop for AI suggestion
}

interface EditorState {
	openNode: boolean;
	openColor: boolean;
	openLink: boolean;
	openAI: boolean;
}

type EditorAction =
	| { type: 'TOGGLE_NODE'; payload: boolean }
	| { type: 'TOGGLE_COLOR'; payload: boolean }
	| { type: 'TOGGLE_LINK'; payload: boolean }
	| { type: 'TOGGLE_AI'; payload: boolean };

function editorReducer(state: EditorState, action: EditorAction): EditorState {
	switch (action.type) {
		case 'TOGGLE_NODE':
			return { ...state, openNode: action.payload };
		case 'TOGGLE_COLOR':
			return { ...state, openColor: action.payload };
		case 'TOGGLE_LINK':
			return { ...state, openLink: action.payload };
		case 'TOGGLE_AI':
			return { ...state, openAI: action.payload };
		default:
			return state;
	}
}

// Update the MenuBar component with icons
const MenuBar = ({
	onAttachmentsChange,
}: {
	onAttachmentsChange?: (attachments: File[]) => void;
}) => {
	const { editor } = useCurrentEditor();
	const [linkDialogOpen, setLinkDialogOpen] = useState(false);
	const [linkUrl, setLinkUrl] = useState('');
	const [attachments, setAttachments] = useState<File[]>([]);

	if (!editor) {
		return null;
	}

	// Replace the old setLink function with this new implementation
	const handleLinkDialogOpen = () => {
		// If a link is already active, pre-fill the input with the current URL
		if (editor.isActive('link')) {
			const attrs = editor.getAttributes('link');
			setLinkUrl(attrs.href || '');
		} else {
			setLinkUrl('');
		}
		setLinkDialogOpen(true);
	};

	const handleSaveLink = () => {
		// empty
		if (linkUrl === '') {
			editor.chain().focus().unsetLink().run();
		} else {
			// Format the URL with proper protocol if missing
			let formattedUrl = linkUrl;
			if (formattedUrl && !/^https?:\/\//i.test(formattedUrl)) {
				formattedUrl = `https://${formattedUrl}`;
			}
			// set link
			editor.chain().focus().setLink({ href: formattedUrl }).run();
		}
		setLinkDialogOpen(false);
	};

	const handleRemoveLink = () => {
		editor.chain().focus().unsetLink().run();
		setLinkDialogOpen(false);
	};

	const handleAttachment = (files: FileList) => {
		const newAttachments = [...attachments, ...Array.from(files)];
		setAttachments(newAttachments);
		onAttachmentsChange?.(newAttachments);
	};

	const handleAttachmentClick = () => {
		const input = document.createElement('input');
		input.type = 'file';
		input.multiple = true;
		input.accept = '*/*';

		input.onchange = (e) => {
			const files = (e.target as HTMLInputElement).files;
			if (files && files.length > 0) {
				handleAttachment(files);
			}
		};

		input.click();
	};

	const removeAttachment = (index: number) => {
		const newAttachments = attachments.filter((_, i) => i !== index);
		setAttachments(newAttachments);
		onAttachmentsChange?.(newAttachments);
	};

	return (
		<>
			<div className="control-group mb-2 overflow-x-auto">
				<div className="button-group ml-2 mt-1 flex flex-wrap gap-1 border-b pb-2">
					<div className="mr-2 flex items-center gap-1">
						<button
							onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
							className={`hover:bg-muted rounded p-1.5 ${editor.isActive('heading', { level: 1 }) ? 'bg-muted' : 'bg-background'}`}
							title="Heading 1"
						>
							<Heading1 className="h-4 w-4" />
						</button>
						<button
							onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
							className={`hover:bg-muted rounded p-1.5 ${editor.isActive('heading', { level: 2 }) ? 'bg-muted' : 'bg-background'}`}
							title="Heading 2"
						>
							<Heading2 className="h-4 w-4" />
						</button>
						<button
							onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
							className={`hover:bg-muted rounded p-1.5 ${editor.isActive('heading', { level: 3 }) ? 'bg-muted' : 'bg-background'}`}
							title="Heading 3"
						>
							<Heading3 className="h-4 w-4" />
						</button>
					</div>

					<Separator orientation="vertical" className="relative right-1 top-0.5 h-6" />
					<div className="mr-2 flex items-center gap-1">
						<button
							onClick={() => editor.chain().focus().toggleBold().run()}
							disabled={!editor.can().chain().focus().toggleBold().run()}
							className={`hover:bg-muted rounded p-1.5 ${editor.isActive('bold') ? 'bg-muted' : 'bg-background'}`}
							title="Bold"
						>
							<Bold className="h-4 w-4" />
						</button>
						<button
							onClick={() => editor.chain().focus().toggleItalic().run()}
							disabled={!editor.can().chain().focus().toggleItalic().run()}
							className={`hover:bg-muted rounded p-1.5 ${editor.isActive('italic') ? 'bg-muted' : 'bg-background'}`}
							title="Italic"
						>
							<Italic className="h-4 w-4" />
						</button>
						<button
							onClick={() => editor.chain().focus().toggleStrike().run()}
							disabled={!editor.can().chain().focus().toggleStrike().run()}
							className={`hover:bg-muted rounded p-1.5 ${editor.isActive('strike') ? 'bg-muted' : 'bg-background'}`}
							title="Strikethrough"
						>
							<Strikethrough className="h-4 w-4" />
						</button>
						<button
							onClick={() => editor.chain().focus().toggleUnderline().run()}
							className={`hover:bg-muted rounded p-1.5 ${editor.isActive('underline') ? 'bg-muted' : 'bg-background'}`}
							title="Underline"
						>
							<Underline className="h-4 w-4" />
						</button>
						<button
							onClick={handleLinkDialogOpen}
							className={`hover:bg-muted rounded p-1.5 ${editor.isActive('link') ? 'bg-muted' : 'bg-background'}`}
							title="Link"
						>
							<LinkIcon className="h-4 w-4" />
						</button>
					</div>

					<Separator orientation="vertical" className="relative right-1 top-0.5 h-6" />

					<div className="flex items-center gap-1">
						<button
							onClick={() => editor.chain().focus().toggleBulletList().run()}
							className={`hover:bg-muted rounded p-1.5 ${editor.isActive('bulletList') ? 'bg-muted' : 'bg-background'}`}
							title="Bullet List"
						>
							<List className="h-4 w-4" />
						</button>
						<button
							onClick={() => editor.chain().focus().toggleOrderedList().run()}
							className={`hover:bg-muted rounded p-1.5 ${editor.isActive('orderedList') ? 'bg-muted' : 'bg-background'}`}
							title="Ordered List"
						>
							<ListOrdered className="h-4 w-4" />
						</button>

						{attachments.length > 0 ? (
							<Popover>
								<PopoverTrigger asChild>
									<button
										className="hover:bg-muted bg-background relative rounded p-1.5"
										title="View Attachments"
									>
										<Paperclip className="h-4 w-4" />
										<span className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-[#016FFE] text-[10px] text-white">
											{attachments.length}
										</span>
									</button>
								</PopoverTrigger>
								<PopoverContent className="w-80 touch-auto" align="end">
									<div className="space-y-2">
										<div className="flex items-center justify-between px-1">
											<h4 className="font-medium leading-none">
												Attachments ({attachments.length})
											</h4>
											<button
												onClick={handleAttachmentClick}
												className="hover:bg-muted bg-background text-muted-foreground rounded px-2 py-1 text-xs"
											>
												Add more
											</button>
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
						) : (
							<button
								onClick={handleAttachmentClick}
								className="hover:bg-muted bg-background rounded p-1.5"
								title="Attach Files"
							>
								<Paperclip className="h-4 w-4" />
							</button>
						)}
					</div>
				</div>
			</div>

			<Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Add Link</DialogTitle>
						<DialogDescription>
							Add a URL to create a link. The link will open in a new tab.
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-4 py-2">
						<div className="flex flex-col gap-2">
							<label htmlFor="url" className="text-sm font-medium">
								URL
							</label>
							<Input
								id="url"
								value={linkUrl}
								onChange={(e) => setLinkUrl(e.target.value)}
								placeholder="https://example.com"
							/>
						</div>
					</div>
					<DialogFooter className="flex justify-between sm:justify-between">
						<Button variant="outline" onClick={handleRemoveLink} type="button">
							Cancel
						</Button>
						<Button onClick={handleSaveLink} type="button">
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
};

export default function Editor({
	initialValue,
	onChange,
	placeholder = 'Start your email here',
	onFocus,
	onBlur,
	className,
	onCommandEnter,
	onAttachmentsChange,
	aiSuggestion,
}: EditorProps) {
	const [state, dispatch] = useReducer(editorReducer, {
		openNode: false,
		openColor: false,
		openLink: false,
		openAI: false,
	});

	// State to track the current AI suggestion
	const [currentSuggestion, setCurrentSuggestion] = useState<string>('');

	// Add a ref to store the editor content to prevent losing it on refresh
	const contentRef = useRef<string>('');
	// Add a ref to the editor instance
	const editorRef = useRef<TiptapEditor>(null);

	const containerRef = useRef<HTMLDivElement>(null);

	const { openNode, openColor, openLink, openAI } = state;

	// Function to focus the editor
	const focusEditor = (e: React.MouseEvent<HTMLDivElement>) => {
		if (e.target === containerRef.current && editorRef.current && editorRef.current.commands) {
			editorRef.current.commands.focus('end');
		}
	};

	// Toggle AI menu
	const toggleAIMenu = () => {
		dispatch({ type: 'TOGGLE_AI', payload: !openAI });
	};

	// Function to clear editor content
	const clearEditorContent = React.useCallback(() => {
		if (editorRef.current) {
			editorRef.current.commands.clearContent(true);
			// Also update our reference and notify parent
			contentRef.current = '';
			onChange('');
		}
	}, [onChange]);

	// Reset editor content when initialValue changes
	React.useEffect(() => {
		// We need to make sure both the editor reference exists AND initialValue is provided
		if (editorRef.current && initialValue) {
			try {
				// Make sure the editor is ready before setting content
				setTimeout(() => {
					// Double-check that the editor still exists in case of unmounting
					if (editorRef.current?.commands?.setContent) {
						editorRef.current.commands.setContent(initialValue);

						// Important: after setting content, manually trigger an update
						// to ensure the parent component gets the latest content
						const html = editorRef.current.getHTML();
						contentRef.current = html;
						onChange(html);
					}
				}, 0);
			} catch (error) {
				console.error('Error setting editor content:', error);
			}
		}
	}, [initialValue, onChange]);

	// Fix useImperativeHandle type errors
	React.useImperativeHandle(editorRef, () => {
		// Only extend the current editor if it exists
		if (!editorRef.current) {
			return {} as TiptapEditor;
		}
		// Otherwise return the editor with our additional methods
	}, [clearEditorContent]);

	// Handle command+enter or ctrl+enter
	const handleCommandEnter = React.useCallback(() => {
		// Call the parent's onCommandEnter
		onCommandEnter?.();

		// Clear the editor content after sending
		setTimeout(() => {
			if (editorRef.current?.commands?.clearContent) {
				clearEditorContent();
			}
		}, 200);
	}, [onCommandEnter, clearEditorContent]);

	// Function to insert AI suggestion into the editor
	const insertAiSuggestion = React.useCallback(() => {
		console.log('insertAiSuggestion called with currentSuggestion:', currentSuggestion);
		console.log('editorRef.current exists:', !!editorRef.current);

		if (!currentSuggestion || !editorRef.current) {
			console.log('Cannot insert suggestion: missing currentSuggestion or editorRef');
			return;
		}

		try {
			// Make sure commands are available
			if (!editorRef.current.commands) {
				console.error('Editor commands not available');
				return;
			}

			// Focus the editor first to ensure the cursor is active
			editorRef.current.commands.focus();

			// Clear existing content if the editor is empty
			const isEmpty = editorRef.current.isEmpty;
			if (isEmpty) {
				editorRef.current.commands.clearContent();
			}

			// Format the suggestion before inserting it
			console.log('Formatting suggestion before insertion');

			// Process the content to maintain proper paragraph structure and spacing
			let formattedSuggestion = currentSuggestion;

			// Fix broken apostrophes that might cause line breaks
			formattedSuggestion = formattedSuggestion.replace(/([A-Za-z])\s*'\s*([A-Za-z])/g, "$1'$2");

			// Split the content by paragraphs (double newlines)
			const paragraphs = formattedSuggestion.split(/\n\s*\n/);

			// Process each paragraph to ensure proper formatting
			const processedParagraphs = paragraphs.map((paragraph) => {
				// Normalize all whitespace within the paragraph
				return paragraph.replace(/\s+/g, ' ').trim();
			});

			// Handle signature separately if it exists
			let mainContent = processedParagraphs;
			let signature = '';

			// Check for signature pattern in the last two paragraphs
			if (processedParagraphs.length >= 2) {
				const lastParagraph = processedParagraphs[processedParagraphs.length - 1];
				const secondLastParagraph = processedParagraphs[processedParagraphs.length - 2];

				// Check if the last paragraph is a name and the second last contains a closing
				if (
					lastParagraph &&
					secondLastParagraph &&
					lastParagraph.length < 20 &&
					/(Best|Regards|Sincerely|Thanks|Thank you|Cheers|Best regards)[,.]?/.test(
						secondLastParagraph,
					)
				) {
					// This is likely a signature
					signature = `${secondLastParagraph}\n${lastParagraph}`;
					mainContent = processedParagraphs.slice(0, -2);
				}
			}

			// Ensure signature is a string (not undefined)
			signature = signature || '';

			// Check for greeting in the first paragraph
			let greeting = '';
			let mainContentStart = 0;

			// Look for greeting pattern in the first paragraph
			const greetingRegex = /^(Hi|Hello|Hey|Dear)\s+[\w\s,]+[,.]?/i;
			if (mainContent.length > 0 && mainContent[0] && greetingRegex.test(mainContent[0])) {
				// Safely assign greeting with type checking
				const firstParagraph = mainContent[0];
				greeting = firstParagraph;
				mainContentStart = 1; // Skip the greeting when processing main content
			}

			// Create proper HTML content for Tiptap
			let htmlContent = '';

			// Add greeting if found, as its own paragraph
			if (greeting) {
				// Make sure greeting ends with a comma if it doesn't already
				if (!greeting.endsWith(',') && !greeting.endsWith('.')) {
					greeting += ',';
				}
				htmlContent += `<p>${greeting}</p>`;
			}

			// Add main content paragraphs (skipping greeting if it was found)
			mainContent.slice(mainContentStart).forEach((paragraph) => {
				htmlContent += `<p>${paragraph}</p>`;
			});

			// Add signature if found
			if (signature) {
				// Safely split the signature string
				const signatureLines = signature.split(/\n/);

				// Add each line of the signature as a separate paragraph
				signatureLines.forEach((line) => {
					// Make sure line is not undefined
					if (line) {
						htmlContent += `<p>${line}</p>`;
					}
				});
			}

			console.log('HTML content for Tiptap:', htmlContent);

			// Insert the HTML content into the editor
			editorRef.current.commands.insertContent(htmlContent, {
				parseOptions: {
					preserveWhitespace: 'full',
				},
			});
			console.log('Successfully inserted formatted suggestion');

			// Update the content reference and notify parent
			const html = editorRef.current.getHTML();
			contentRef.current = html;
			onChange(html);

			// Clear the current suggestion after inserting
			setCurrentSuggestion('');
		} catch (error) {
			console.error('Error inserting AI suggestion:', error);
		}
	}, [currentSuggestion, onChange]);

	// Update currentSuggestion when aiSuggestion prop changes
	React.useEffect(() => {
		console.log('aiSuggestion prop changed:', aiSuggestion);
		console.log('Current currentSuggestion state:', currentSuggestion);

		// Always update currentSuggestion when aiSuggestion changes, even if it's empty
		console.log('Setting currentSuggestion to:', aiSuggestion);
		setCurrentSuggestion(aiSuggestion || ''); // Ensure we handle null/undefined cases
	}, [aiSuggestion]);

	// Monitor currentSuggestion state changes
	React.useEffect(() => {
		console.log('currentSuggestion state updated:', currentSuggestion);
	}, [currentSuggestion]);

	return (
		<div
			className={`relative w-full max-w-[450px] sm:max-w-[600px] ${className || ''}`}
			onClick={focusEditor}
			onKeyDown={(e) => {
				if (e.key === 'Enter' && !e.shiftKey) {
					e.stopPropagation();
				}

				if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
					e.preventDefault();
					e.stopPropagation();
					handleCommandEnter();
				}
			}}
		>
			<EditorRoot>
				<EditorContent
					immediatelyRender={false}
					initialContent={defaultEditorContent}
					extensions={extensions}
					ref={containerRef}
					className="cursor-text"
					editorProps={{
						handleDOMEvents: {
							keydown: (view, event) => {
								if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
									event.preventDefault();
									handleCommandEnter();
									return true;
								}

								if (event.key === 'Tab') {
									if (currentSuggestion) {
										event.preventDefault();
										insertAiSuggestion();
										return true;
									}
								}

								return handleCommandNavigation(event);
							},
							focus: () => {
								onFocus?.();
								return false;
							},
							blur: () => {
								onBlur?.();
								return false;
							},
						},
						handlePaste: (view, event) => handleImagePaste(view, event, uploadFn),
						handleDrop: (view, event, _slice, moved) =>
							handleImageDrop(view, event, moved, uploadFn),
						attributes: {
							class:
								'prose dark:prose-invert prose-headings:font-title font-default focus:outline-none max-w-full prose-p:my-5',
							'data-placeholder': placeholder,
						},
					}}
					onCreate={({ editor }) => {
						editorRef.current = editor;
					}}
					onUpdate={({ editor }) => {
						// Store the content in the ref to prevent losing it
						contentRef.current = editor.getHTML();
						onChange(editor.getHTML());
					}}
					slotBefore={<MenuBar onAttachmentsChange={onAttachmentsChange} />}
					slotAfter={<ImageResizer />}
				>
					{/* Make sure the command palette doesn't cause a refresh */}
					<EditorCommand
						className="border-muted bg-background z-50 h-auto max-h-[330px] overflow-y-auto rounded-md border px-1 py-2 shadow-md transition-all"
						onKeyDown={(e) => {
							// Prevent form submission on any key that might trigger it
							if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
								e.preventDefault();
								e.stopPropagation();
							}
						}}
					>
						{/* Rest of the command palette */}
						<EditorCommandEmpty className="text-muted-foreground px-2">
							No results
						</EditorCommandEmpty>
						<EditorCommandList>
							{suggestionItems.map((item) => (
								<EditorCommandItem
									value={item.title}
									onCommand={(val) => {
										// Prevent default behavior that might cause refresh
										item.command?.(val);
										return false;
									}}
									className="hover:bg-accent aria-selected:bg-accent flex w-full items-center space-x-2 rounded-md px-2 py-1 text-left text-[10px]"
									key={item.title}
								>
									<div className="border-muted bg-background flex h-8 w-8 items-center justify-center rounded-md border">
										{item.icon}
									</div>
									<div>
										<p className="text-xs font-medium">{item.title}</p>
										<p className="text-muted-foreground text-[8px]">{item.description}</p>
									</div>
								</EditorCommandItem>
							))}
						</EditorCommandList>
					</EditorCommand>

					{currentSuggestion && currentSuggestion.length > 0 ? (
						<div className="bg-muted/30 text-muted-foreground absolute bottom-0 left-0 right-0 z-50 border-t p-2 text-sm backdrop-blur-sm">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-1 text-xs">
									<span className="bg-primary/10 text-primary rounded px-1 py-0.5 text-[10px] font-medium">
										AI Suggestion
									</span>
									<span>
										Press{' '}
										<kbd className="bg-background rounded border px-1 py-0.5 text-[10px]">Tab</kbd>{' '}
										to accept
									</span>
								</div>
								<Button
									variant="ghost"
									size="sm"
									className="h-6 w-6 p-0"
									onClick={() => {
										console.log('Clearing suggestion');
										setCurrentSuggestion('');
									}}
								>
									<X className="h-3 w-3" />
								</Button>
							</div>
							<div className="mt-1 max-h-32 overflow-auto text-xs italic">{currentSuggestion}</div>
						</div>
					) : null}

					{/* Replace the default editor menu with just our TextButtons */}
					<EditorMenu
						open={openAI}
						onOpenChange={(open) => dispatch({ type: 'TOGGLE_AI', payload: open })}
					>
						{/* Empty children to satisfy the type requirement */}
						<div></div>
					</EditorMenu>
				</EditorContent>
			</EditorRoot>
		</div>
	);
}
