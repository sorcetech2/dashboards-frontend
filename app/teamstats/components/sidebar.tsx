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
    <ScrollArea className="mb-5 max-h-64 rounded-md border md:h-[calc(100vh-7rem)] md:max-h-none">
      <div className="p-5">
        <nav aria-label="Companies">
          <h2 className="mb-4 text-sm font-medium leading-none">Companies</h2>
          {companyStats.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No company data is available.
            </p>
          )}
          {companyStats.map((company) => (
            <div key={company.company_name}>
              <Link
                href={`?company=${encodeURIComponent(company.company_name)}`}
                aria-current={
                  selectedCompany === company.company_name ? 'page' : undefined
                }
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
                      : 'text-current/70'
                  }
                >
                  {company.company_name}
                </span>
                <span
                  className="rounded-sm border p-1 ml-auto"
                  aria-label={`${company.recent_active_members} recently active members`}
                >
                  {company.recent_active_members}
                </span>
              </Link>
              <Separator className="my-2" />
            </div>
          ))}
        </nav>
      </div>
    </ScrollArea>
  );
}
