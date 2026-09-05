'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';

export interface SwitchableTeam {
  value: string;
  name: string;
}

type PopoverTriggerProps = React.ComponentPropsWithoutRef<
  typeof PopoverTrigger
>;

interface TeamSwitcherProps extends PopoverTriggerProps {
  teams: SwitchableTeam[];
}

function decodeRouteSegment(segment: string | undefined): string | null {
  if (!segment) return null;

  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function TeamSwitcher({ className, teams }: TeamSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  const routeTeamValue = decodeRouteSegment(pathname?.split('/')[2]);
  const selectedTeam =
    teams.find((team) => team.value === routeTeamValue) ?? teams[0];

  const selectTeam = (team: SwitchableTeam) => {
    setOpen(false);
    router.push(`/dashboard/${encodeURIComponent(team.value)}`);
  };

  if (teams.length === 0) {
    return (
      <Button
        variant="outline"
        disabled
        aria-label="No teams available"
        className={cn(
          'min-w-0 max-w-full flex-1 justify-between sm:w-[220px] sm:flex-none',
          className
        )}
      >
        <span className="min-w-0 truncate text-left">No teams available</span>
      </Button>
    );
  }

  const canSelect = teams.length > 1;
  const selectedLabel = selectedTeam?.name ?? 'Select a team';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={`Selected team: ${selectedLabel}`}
          disabled={!canSelect}
          className={cn(
            'min-w-0 max-w-full flex-1 justify-between sm:w-[220px] sm:flex-none',
            className
          )}
        >
          <span className="shrink-0 rounded-full bg-white p-1 text-xs text-gray-900">
            {selectedTeam ? getShortName(selectedTeam.name) : '—'}
          </span>
          <span className="min-w-0 flex-1 truncate px-1 text-left">
            {selectedLabel}
          </span>
          {canSelect && (
            <ChevronsUpDown
              aria-hidden="true"
              className="ml-auto h-4 w-4 shrink-0 opacity-50"
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(90vw,22rem)] p-0">
        <Command>
          <CommandInput
            placeholder="Search team..."
            aria-label="Search teams"
          />
          <CommandList>
            <CommandEmpty>No teams found.</CommandEmpty>
            <CommandGroup heading="Teams">
              {teams.map((team) => {
                const isSelected = selectedTeam?.value === team.value;

                return (
                  <CommandItem
                    key={team.value}
                    value={`${team.name} ${team.value}`}
                    onSelect={() => selectTeam(team)}
                    aria-selected={isSelected}
                    aria-current={isSelected ? 'true' : undefined}
                    className="flex w-full items-center gap-2 text-sm"
                  >
                    <span className="shrink-0 rounded-full bg-white p-1 text-xs text-gray-900">
                      {getShortName(team.name)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{team.name}</span>
                    <Check
                      aria-hidden="true"
                      className={cn(
                        'ml-auto h-4 w-4 shrink-0',
                        isSelected ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function getShortName(companyName: string): string {
  const words = companyName
    .replace(/[^a-zA-Z\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return '—';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

  return `${words[0].charAt(0)}${words[1].charAt(0)}`.toUpperCase();
}
