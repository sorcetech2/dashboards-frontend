import type { ReactNode } from 'react';
import { CircleHelp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';

interface TopCardProps {
  title: string;
  help?: string | null;
  children?: ReactNode;
}

const TopCard = ({ title, help, children }: TopCardProps) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium inline-flex gap-1 items-center">
          {title}
          {help && <HelpTooltip>{help}</HelpTooltip>}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
};

const HelpTooltip = ({ children }: { children: ReactNode }) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="More information"
            className="inline-flex h-5 w-5 items-center justify-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <CircleHelp aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="bg-white p-2 rounded-md shadow-lg">
          <div className="text-sm text-black">{children}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export { TopCard, HelpTooltip };
