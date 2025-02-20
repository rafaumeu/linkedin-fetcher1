export interface LinkedInApiResponse {
    included: LinkedInElement[];
    data: any;
}

export interface LinkedInElement {
    $type: string;
    title?: string;
    companyName?: string;
    startDate?: {
        month: number;
        year: number;
    };
    endDate?: {
        month: number;
        year: number;
    };
    description?: string;
    skills?: string[];
}
