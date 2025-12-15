import React from 'react';
import DOMPurify from 'dompurify';
import { cn } from '../../lib/utils';

interface RichTextDisplayProps {
  content: string;
  className?: string;
  clamp?: boolean;
  onCheckboxChange?: (newContent: string) => void;
}

export const RichTextDisplay: React.FC<RichTextDisplayProps> = ({ content, className, clamp, onCheckboxChange }) => {
  if (!content) return null;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // If not interactive, ignore
    if (!onCheckboxChange) return;

    const target = e.target as HTMLElement;
    
    // Look for checkbox interactions. 
    // We check inputs and labels that might wrap them.
    const checkbox = target.closest('input[type="checkbox"]');
    
    if (checkbox) {
      // STOP PROPAGATION IMMEDIATELY to prevent opening the modal/editor
      e.stopPropagation();
      //e.preventDefault(); // Do NOT prevent default here, let the visual change happen (or handle manually)
      // Actually, since we update the content prop, React re-renders. 
      // If we prevent default, the checkbox won't visually toggle until re-render.
      // But if we don't prevent default, the browser toggles it, then React re-renders with new HTML.
      // The issue before was likely propagation collapsing the card.

      // Find the parent list item
      const li = checkbox.closest('li[data-type="taskItem"]');
      
      if (li) {
        // Find index of this checkbox in the container
        const container = e.currentTarget;
        const allCheckboxes = Array.from(container.querySelectorAll('li[data-type="taskItem"] input[type="checkbox"]'));
        const index = allCheckboxes.indexOf(checkbox as HTMLInputElement);
        
        if (index !== -1) {
           // Parse and toggle
           const parser = new DOMParser();
           const doc = parser.parseFromString(content, 'text/html');
           const docCheckboxes = doc.querySelectorAll('li[data-type="taskItem"] input[type="checkbox"]');
           
           if (docCheckboxes[index]) {
               const targetCheckbox = docCheckboxes[index] as HTMLInputElement;
               if (targetCheckbox.hasAttribute('checked')) {
                   targetCheckbox.removeAttribute('checked');
               } else {
                   targetCheckbox.setAttribute('checked', 'checked');
               }
               
               onCheckboxChange(doc.body.innerHTML);
           }
        }
      }
    }
  };

  const sanitizedContent = DOMPurify.sanitize(content);

  const contentWithTargets = sanitizedContent.replace(
    /<a /g, 
    '<a target="_blank" rel="noopener noreferrer" '
  );

  return (
    <>
      <style>{`
        .tiptap-display-content p {
          min-height: 1.5em;
        }

        .tiptap-display-content ul[data-type="taskList"] {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        
        .tiptap-display-content ul[data-type="taskList"] li[data-type="taskItem"] {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem; /* gap-3 equivalent */
          margin-bottom: 0.25rem;
        }

        .tiptap-display-content ul[data-type="taskList"] li[data-type="taskItem"] > label {
          flex: 0 0 auto;
          margin-top: 0.125rem; /* mt-0.5 equivalent */
          user-select: none;
          /* Custom Checkbox visual replication */
          position: relative;
          display: flex;
          align-items: center;
        }
        
        /* Hide default checkbox but keep it accessible for interaction */
        .tiptap-display-content ul[data-type="taskList"] li[data-type="taskItem"] > label > input[type="checkbox"] {
           appearance: none;
           -webkit-appearance: none;
           width: 1rem; /* 16px */
           height: 1rem;
           border-radius: 0.375rem; /* rounded-md */
           border: 2px solid #e5e7eb; /* border-gray-200 */
           cursor: pointer;
           background-color: white;
           transition: all 0.2s;
           margin: 0; /* Reset margin */
        }

        .tiptap-display-content ul[data-type="taskList"] li[data-type="taskItem"] > label > input[type="checkbox"]:checked {
           background-color: var(--color-primary, #3b82f6);
           border-color: var(--color-primary, #3b82f6);
           background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e");
           background-size: 100% 100%;
           background-position: center;
           background-repeat: no-repeat;
        }

        .tiptap-display-content ul[data-type="taskList"] li[data-type="taskItem"] > div {
          flex: 1 1 auto;
          min-width: 0;
          margin: 0;
          padding-top: 0.125rem; /* pt-0.5 equivalent to align baseline */
        }
        
        .tiptap-display-content ul[data-type="taskList"] li[data-type="taskItem"] > div > p {
            margin: 0;
        }
      `}</style>
      <div 
        onClick={handleClick}
        className={cn(
          "tiptap-display-content prose prose-sm max-w-none",
          "prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0",
          "prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline",
          onCheckboxChange && "interactive",
          clamp && "line-clamp-2",
          className
        )}
        dangerouslySetInnerHTML={{ __html: contentWithTargets }}
      />
    </>
  );
};
