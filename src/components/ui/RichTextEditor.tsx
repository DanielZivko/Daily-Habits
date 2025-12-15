import React from 'react';
import { useEditor, EditorContent, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, CheckSquare, Link as LinkIcon, X, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Input } from './Input';
import { Checkbox } from './Checkbox';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';

// Custom Task Item Node View for Tiptap
const TaskItemComponent = ({ node, updateAttributes }: any) => {
  return (
    <NodeViewWrapper className="flex items-start gap-3 my-1">
      <div className="flex-none mt-0.5" contentEditable={false}>
        <Checkbox 
          checked={node.attrs.checked} 
          onCheckedChange={(checked) => updateAttributes({ checked })}
          checkSize="md"
        />
      </div>
      <NodeViewContent className="flex-1 min-w-0 [&_p]:m-0" />
    </NodeViewWrapper>
  );
};

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, className }) => {
  const [isLinkPopoverOpen, setIsLinkPopoverOpen] = React.useState(false);
  const [linkUrl, setLinkUrl] = React.useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-500 hover:underline cursor-pointer',
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      TaskList,
      TaskItem.extend({
        addNodeView() {
          return ReactNodeViewRenderer(TaskItemComponent);
        },
      }).configure({
        nested: true,
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none focus:outline-none min-h-[100px] px-3 py-2",
          "prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0",
          "prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline",
          // Reset default list styles for task list since we handle it with NodeView
          "[&_ul[data-type='taskList']]:list-none [&_ul[data-type='taskList']]:pl-0",
        ),
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  const openLinkPopover = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    setLinkUrl(previousUrl || '');
    setIsLinkPopoverOpen(true);
  };

  const applyLink = () => {
    if (!editor) return;
    
    if (linkUrl === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      let finalUrl = linkUrl;
      // Add https:// if no protocol is present
      if (finalUrl && !/^https?:\/\//i.test(finalUrl) && !/^mailto:/i.test(finalUrl)) {
        finalUrl = `https://${finalUrl}`;
      }
      editor.chain().focus().extendMarkRange('link').setLink({ href: finalUrl }).run();
    }
    
    setIsLinkPopoverOpen(false);
  };

  const ToolbarButton = ({ 
    onClick, 
    isActive, 
    icon: Icon 
  }: { 
    onClick: () => void; 
    isActive: boolean; 
    icon: React.ElementType; 
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "p-1.5 rounded transition-colors",
        isActive ? "bg-blue-100 text-blue-600" : "text-gray-500 hover:bg-gray-100"
      )}
    >
      <Icon size={16} />
    </button>
  );

  if (!editor) {
    return null;
  }

  return (
    <div className={cn("relative rounded-lg border border-gray-200 bg-white overflow-hidden focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500", className)}>
      <div className="flex flex-wrap items-center gap-1 border-b border-gray-100 bg-gray-50/50 p-1">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          icon={Bold}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          icon={Italic}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          icon={UnderlineIcon}
        />
        <div className="w-px h-4 bg-gray-200 mx-1" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          icon={List}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          icon={ListOrdered}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          isActive={editor.isActive('taskList')}
          icon={CheckSquare}
        />
        <div className="w-px h-4 bg-gray-200 mx-1" />
        <ToolbarButton
          onClick={openLinkPopover}
          isActive={editor.isActive('link') || isLinkPopoverOpen}
          icon={LinkIcon}
        />
      </div>
      
      {isLinkPopoverOpen && (
        <div className="absolute top-10 left-2 right-2 z-10 flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 shadow-lg animate-in fade-in zoom-in-95 duration-200">
           <Input 
             autoFocus
             placeholder="https://exemplo.com"
             value={linkUrl}
             onChange={(e) => setLinkUrl(e.target.value)}
             className="h-8 text-sm"
             onKeyDown={(e) => {
               if (e.key === 'Enter') applyLink();
               if (e.key === 'Escape') setIsLinkPopoverOpen(false);
             }}
           />
           <div className="flex gap-1">
               <button 
                 onClick={applyLink}
                 className="flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
               >
                  <Check size={14} />
               </button>
               <button 
                 onClick={() => setIsLinkPopoverOpen(false)}
                 className="flex h-8 w-8 items-center justify-center rounded bg-gray-100 text-gray-500 hover:bg-gray-200"
               >
                  <X size={14} />
               </button>
           </div>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
};
