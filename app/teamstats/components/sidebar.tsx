'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { CompanyStats } from '@/lib/sorce_data';
import Link from 'next/link';

export function Sidebar({
  companyStats,
  selectedCompany
}: {
  companyStats: CompanyStats[];
  selectedCompany: string | null;
}) {
  return (
    <ScrollArea className="h-[calc(100vh-5rem)] rounded-md border mb-5">
      <div className="p-5">
        <h4 className="mb-4 text-sm font-medium leading-none">Companies</h4>
        {companyStats.map((company) => (
          <div key={company.company_name}>
            <Link
              href={`?company=${encodeURIComponent(company.company_name)}`}
              className={`
                text-sm flex items-center justify-between p-2 rounded-md
                hover:bg-accent hover:text-accent-foreground
                ${selectedCompany === company.company_name ? 'bg-accent text-accent-foreground' : ''}
              `}
            >
              <span
                className={
                  selectedCompany === company.company_name
                    ? 'text-current'
                    : 'text-current/50'
                }
              >
                {company.company_name}
              </span>
              <span className="rounded-sm p-1 border ml-auto">
                {company.recent_active_members}
              </span>
            </Link>
            <Separator className="my-2" />
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
