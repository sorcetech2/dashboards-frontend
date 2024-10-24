import {  ReactNode } from 'react';
import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QuestionMarkCircledIcon } from '@radix-ui/react-icons';
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

const TopCard: React.FC<TopCardProps> = ({ title, help, children }) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium inline-flex gap-1 items-center">
          {title}
          {help && <HelpTooltip>{help}</HelpTooltip>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  );
};

const HelpTooltip: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <QuestionMarkCircledIcon />
        </TooltipTrigger>
        <TooltipContent className="bg-white p-2 rounded-md shadow-lg">
          <div className="text-sm text-black">{children}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export {TopCard, HelpTooltip};