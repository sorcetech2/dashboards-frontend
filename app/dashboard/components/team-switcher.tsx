'use client';

import * as React from 'react';
import {
  CaretSortIcon,
  CheckIcon,
  PlusCircledIcon,
  ExitIcon
} from '@radix-ui/react-icons';
import { signOut } from 'next-auth/react';

import { useRouter, usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import Link from 'next/link';

export interface SwitchableTeam {
  value: string;
  name: string;
}

// const groups = [
//   {
//     label: 'Personal Account',
//     teams: [
//       {
//         label: 'Ashland Studios',
//         value: 'personal'
//       }
//     ]
//   },
//   {
//     label: 'Teams',
//     teams: [
//       {
//         label: 'Acme Inc.',
//         value: 'acme-inc'
//       },
//       {
//         label: 'Monsters Inc.',
//         value: 'monsters'
//       }
//     ]
//   }
// ];

// type Team = (typeof groups)[number]['teams'][number];

type PopoverTriggerProps = React.ComponentPropsWithoutRef<
  typeof PopoverTrigger
>;

interface TeamSwitcherProps extends PopoverTriggerProps {
  teams: SwitchableTeam[];
}

export function TeamSwitcher({ className, teams }: TeamSwitcherProps) {
  const router = useRouter();

  const groups = [
    {
      label: 'Teams',
      teams: teams
    }
  ];

  const [open, setOpen] = React.useState(false);
  // const [showNewTeamDialog, setShowNewTeamDialog] = React.useState(false);
  // const [selectedTeam, setSelectedTeam] = React.useState<SwitchableTeam>(
  //   groups[0].teams[0]
  // );
  var selectedTeam = groups[0].teams[0];
  const components = usePathname().split('/');
  if (components.length > 2) {
    const overridenTeam = groups[0].teams.find(
      (team) => team.value === components[2]
    );
    if (overridenTeam) {
      selectedTeam = overridenTeam;
    }
  }
  // const selectedTeam = usePathname().split('/')[2];
  // console.log(selectedTeam);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select a team"
          className={cn('w-[200px] justify-between', className)}
        >
          <span className="rounded-full bg-white text-xs p-1 text-gray-900">
            {getShortName(selectedTeam.name)}
          </span>
          {selectedTeam.name}
          <CaretSortIcon className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          {/* <CommandInput placeholder="Search team..." /> */}
          <CommandList>
            <CommandEmpty>No team found.</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup key={group.label} heading={group.label}>
                {group.teams.map((team) => (
                  <CommandItem
                    key={team.value}
                    // onSelect={() => {
                    // setSelectedTeam(team);
                    // setOpen(false);
                    //   // console.log('ROUTER');
                    //   // router.push(`/dashboard/${team.value}`);
                    // }}
                    className="text-sm"
                  >
                    <Link
                      href={`/dashboard/${team.value}`}
                      className="inline-flex"
                    >
                      <span className="rounded-full bg-white text-xs p-1 text-gray-900 mr-1">
                        {getShortName(selectedTeam.name)}
                      </span>

                      {team.name}
                      <CheckIcon
                        className={cn(
                          'ml-auto h-4 w-4',
                          selectedTeam.value === team.value
                            ? 'opacity-100'
                            : 'opacity-0'
                        )}
                      />
                    </Link>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
          <CommandSeparator />
          <CommandList>
            <CommandGroup>
              {/* <DialogTrigger asChild> */}
              <CommandItem
                onSelect={() => {
                  signOut();
                }}
              >
                <ExitIcon className="mr-2 h-5 w-5" />
                Sign Out
              </CommandItem>
              {/* </DialogTrigger> */}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function getShortName(companyName: string): string {
  // Remove any special characters and extra spaces
  const cleanedName = companyName.replace(/[^a-zA-Z\s]/g, '').trim();

  // Split the company name into words
  const words = cleanedName.split(/\s+/);

  let shortName = '';

  if (words.length === 1) {
    // If it's a single word, take the first two letters of the word
    shortName = words[0].slice(0, 2).toUpperCase();
  } else if (words.length > 1) {
    // If there are multiple words, take the first letter of the first two words
    shortName = words[0].charAt(0) + words[1].charAt(0);
  }

  return shortName.toUpperCase();
}
