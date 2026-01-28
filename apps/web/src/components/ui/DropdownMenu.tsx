import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface DropdownMenuProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

export function DropdownMenu({ trigger, children, align = 'right', className }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={cn('relative', className)} ref={menuRef}>
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>
      {isOpen && (
        <div
          className={cn(
            'absolute top-full mt-1 z-50 min-w-[160px] bg-white rounded-lg shadow-lg border border-gray-200 py-1',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          <div onClick={() => setIsOpen(false)}>{children}</div>
        </div>
      )}
    </div>
  );
}

interface DropdownMenuItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  destructive?: boolean;
}

export function DropdownMenuItem({ children, onClick, className, destructive }: DropdownMenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors',
        destructive
          ? 'text-red-600 hover:bg-red-50'
          : 'text-gray-700 hover:bg-gray-100',
        className
      )}
    >
      {children}
    </button>
  );
}

export function DropdownMenuSeparator() {
  return <div className="my-1 border-t border-gray-200" />;
}
