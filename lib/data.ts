import { promises as fs } from 'fs';
import path from 'path';
import { CompanyStats, SorceData } from '@/lib/sorce_data';
import { findUserByName } from './users';
import crypto from 'crypto';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const isDebug = true;
const BUCKET_NAME = 'sorce-dashboard-data';

// Initialize S3 client
const s3Client = new S3Client({
  region: 'us-east-1' // replace with your region
});

async function readFromS3(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key
  });

  const response = await s3Client.send(command);
  if (!response.Body) {
    throw new Error('No body in S3 response');
  }

  return await response.Body.transformToString();
}

export async function retrieveData(
  username: string | null | undefined
): Promise<SorceData | null> {
  if (!username) {
    console.log('No username provided');
    return null;
  }
  const user = await findUserByName(username);
  if (!user) {
    console.log('User not found for', username);
    return null;
  }

  const filename = makeUrl(user.displayName);
  console.log(filename);

  try {
    let jsonData: string;

    if (isDebug) {
      // Read from filesystem in debug mode
      const filePath = path.join(process.cwd(), 'public', filename);
      jsonData = await fs.readFile(filePath, 'utf-8');
    } else {
      // Read from S3 in production mode
      console.log(`companies/${filename}`);
      jsonData = await readFromS3(`companies/${filename}`);
    }

    return JSON.parse(jsonData);
  } catch (error) {
    console.error('Error reading data:', error);
    return null;
  }
}

export async function teamStats(): Promise<CompanyStats[]> {
  const filename = 'team_stats.json';

  try {
    let jsonData: string;

    if (isDebug) {
      // Read from filesystem in debug mode
      const filePath = path.join(process.cwd(), 'public', filename);
      jsonData = await fs.readFile(filePath, 'utf-8');
    } else {
      // Read from S3 in production mode
      jsonData = await readFromS3(`companies/${filename}`);
    }

    return JSON.parse(jsonData) as Array<CompanyStats>;
  } catch (error) {
    console.error('Error reading team stats:', error);
    throw error;
  }
}

function makeUrl(company: string): string {
  function hashString(string: string): string {
    const m = crypto.createHash('sha256');
    m.update(string);
    m.update(Buffer.from('12ca4b05c51ea3528e3904ef7fedfaa5')); // add a salt
    return m.digest('hex');
  }

  const c = hashString(company);
  return `${c}.data.json`;
}
