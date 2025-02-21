export interface LinkedInApiResponse {
  included: LinkedInElement[];
  data: LinkedInData;
}

interface LinkedInData {
  id: string;
  firstName: string;
  lastName: string;
  headline?: string;
  publicIdentifier: string;
  profilePicture?: {
    displayImage: string;
  };
}

interface LinkedInElement {
  entityUrn: string;
  $type: string;
  title?: string;
  companyName?: string;
  description?: string;
  dateRange?: {
    start: { year: number; month?: number };
    end?: { year: number; month?: number };
  };
}
