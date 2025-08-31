"use server";

// Define the DashboardUser type
interface DashboardUser {
  id: string;
  username: string;
  code: string;
  displayName: string;
  admin: boolean;
}

// Create an array of DashboardUser instances
const hardcodedUsers: DashboardUser[] = [
  {
    id: '14',
    username: 'petnutrition',
    code: 'f6cb0b70f',
    displayName: 'Pet Nutrition',
    admin: false
  },
  {
    id: '16',
    username: 'royalcanin',
    code: 'ffbe77c6',
    displayName: 'Royal Canin',
    admin: false
  },
  {
    id: '19',
    username: 'ferrotec',
    code: 'dc63d35f',
    displayName: 'Ferrotec',
    admin: false
  },
  {
    id: '2',
    username: 'sorce',
    code: '93418d',
    displayName: 'SORCE',
    admin: true
  },
  {
    id: '25',
    username: 'vipjune2023',
    code: '9fsm9sua',
    displayName: 'VIP June 2023',
    admin: false
  },
  {
    id: '26',
    username: 'regenerative_summer_camp',
    code: '84tls9aod',
    displayName: 'Regenerative Summer Camp',
    admin: false
  },
  {
    id: '27',
    username: 'erin_heidenreich',
    code: '73hsd393',
    displayName: 'Erin Heidenreich',
    admin: false
  },
  {
    id: '30',
    username: 'elemental_shift_consulting',
    code: '41doms77%',
    displayName: 'Elemental Shift Consulting',
    admin: false
  },
  {
    id: '32',
    username: 'bonusly',
    code: '4wuklis43',
    displayName: 'Bonusly',
    admin: false
  },
  {
    id: '33',
    username: 'liberty_company',
    code: 'k48ferfly3',
    displayName: 'Liberty Company',
    admin: false
  },
  {
    id: '35',
    username: 'regenerate_mentorship',
    code: '7wiwakuh98',
    displayName: 'Regenerate Mentorship',
    admin: false
  },
  {
    id: '36',
    username: 'that_hrv_guy',
    code: 'k8bera55',
    displayName: 'That HRV guy',
    admin: false
  },
  {
    id: '38',
    username: 'dotconnect',
    code: 'a1p3n42',
    displayName: 'DotConnect',
    admin: false
  },
  {
    id: '39',
    username: 'ashland_studios',
    code: 'c%4td8g!',
    displayName: 'Ashland Studios',
    admin: false
  },
  {
    id: '40',
    username: 'ima',
    code: 'h8r7me%8',
    displayName: 'IMA',
    admin: false
  },
  {
    id: '41',
    username: 'source_x_jade',
    code: 't4uyo%nar!',
    displayName: 'SORCE Lab x Jade Wolf',
    admin: false
  },
  {
    id: '42',
    username: 'the_practice',
    code: 'm4as!kra%',
    displayName: 'The Practice',
    admin: false
  },
  {
    id: '44',
    username: 'authenica',
    code: 'd4mini%eul55',
    displayName: 'Authenica',
    admin: false
  },
  {
    id: '47',
    username: 'wwcma',
    code: 'e1ne-meg8-yet%',
    displayName: 'WWCMA',
    admin: false
  },
  {
    id: '48',
    username: 'authenica2',
    code: 'b9oYi!BuR72',
    displayName: 'Authenica Cohort 2',
    admin: false
  },
  //     {
  //   id: '49',
  //   username: 'the_practice_30days',
  //   code: 'glowing2-waves!',
  //   displayName: 'The 30-Day Practice Experience',
  //   admin: false
  // },
      {
    id: '50',
    username: 'MOSS',
    code: 'zen-harbor4%',
    displayName: 'MOSS',
    admin: false
  },
      {
    id: '51',
    username: 'the_practice_fall',
    code: 'calm-breeze3!',
    displayName: 'The Practice: Fall Cohort',
    admin: false
  },
    {
    id: '52',
    username: 'authenica3',
    code: 'feeling%-good8',
    displayName: 'Authenica Cohort 3',
    admin: false
  },
];

export async function validateUser(
  username: unknown,
  password: unknown
): Promise<DashboardUser | undefined> {
  return hardcodedUsers.find((value) => {
    return value.username === username && value.code === password;
  });
}

export async function isAdmin(name: string | undefined | null): Promise<boolean> {
  const user = await findUserByName(name);
  if (!user) return false;
  return user.admin;
}

// Find user by name
export async function findUserByName(
  name: string | undefined | null
): Promise<DashboardUser | null> {
  if (!name) return null;
  let user = await hardcodedUsers.find((value) => {
    return value.username == name;
  });
  if (!user) {
    return null;
  }
  return user;
}
