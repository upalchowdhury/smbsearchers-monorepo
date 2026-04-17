import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/hooks/useSidebar';

interface SidebarItemProps {
    icon: LucideIcon;
    label: string;
    href: string;
    badge?: string;
    children?: React.ReactNode;
}

export function SidebarItem({ icon: Icon, label, href, badge, children }: SidebarItemProps) {
    const pathname = usePathname();
    const isActive = pathname === href || pathname.startsWith(`${href}/`);
    const { isCollapsed } = useSidebar();

    const content = (
        <>
            <Icon className={cn('h-5 w-5 shrink-0', isActive ? 'text-indigo-600' : 'text-slate-500')} />
            {!isCollapsed && (
                <span className={cn('ml-3 flex-1 truncate', isActive ? 'font-medium text-indigo-900' : 'text-slate-700')}>
                    {label}
                </span>
            )}
            {!isCollapsed && badge && (
                <span className="ml-auto inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                    {badge}
                </span>
            )}
            {!isCollapsed && children}
        </>
    );

    return (
        <Link
            href={href}
            className={cn(
                'group flex items-center rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                    ? 'bg-indigo-50/80'
                    : 'hover:bg-slate-100/80',
                isCollapsed ? 'justify-center px-0' : ''
            )}
            title={isCollapsed ? label : undefined}
        >
            {content}
        </Link>
    );
}
