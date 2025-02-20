import axios from 'axios';
import * as cheerio from 'cheerio';
import { IProfile, IExperience, IEducation, ISkill, ICertification } from '../types/Profile';

export class LinkedInScrapper {
    private readonly headers: Record<string, string>;
    private readonly cookieString: string;

    constructor(cookieString: string) {
        this.cookieString = cookieString;
        this.headers = this.getCommonHeaders();
    }

    private getCommonHeaders(): Record<string, string> {
        return {
            'accept': 'application/vnd.linkedin.normalized+json+2.1',
            'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'cookie': this.cookieString,
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121.0.0.0'
        };
    }

    public async validateToken(): Promise<boolean> {
        try {
            const response = await axios.get('https://www.linkedin.com/voyager/api/me', {
                headers: this.headers,
                maxRedirects: 5,
                validateStatus: () => true
            });
            return response.status === 200;
        } catch (error) {
            console.error('Erro ao validar token:', error);
            return false;
        }
    }

    public async extrairPerfil(username: string): Promise<IProfile> {
        try {
            const response = await axios.get(`https://www.linkedin.com/in/${username}`, {
                headers: this.headers
            });

            const $ = cheerio.load(response.data);
            
            return {
                name: this.extractName($),
                headline: this.extractHeadline($),
                location: this.extractLocation($),
                experiences: this.parseExperiencesFromApi(response.data),
                education: this.extractEducation($),
                skills: this.extractSkills($),
                certifications: this.extractCertifications($)
            };
        } catch (error) {
            console.error('Erro ao extrair perfil:', error);
            throw new Error('Falha ao extrair dados do perfil');
        }
    }

    private extractName($: cheerio.Root): string {
        return $('.text-heading-xlarge').first().text().trim();
    }

    private extractHeadline($: cheerio.Root): string {
        return $('.text-body-medium').first().text().trim();
    }

    private extractLocation($: cheerio.Root): string {
        return $('.text-body-small').first().text().trim();
    }

    private extractEducation($: cheerio.Root): IEducation[] {
        const education: IEducation[] = [];
        $('.education-item').each((_, el) => {
            education.push({
                school: $(el).find('.education-item-school').text().trim(),
                degree: $(el).find('.education-item-degree').text().trim(),
                period: $(el).find('.education-item-period').text().trim()
            });
        });
        return education;
    }

    private extractSkills($: cheerio.Root): ISkill[] {
        const skills: ISkill[] = [];
        $('.skill-item').each((_, el) => {
            skills.push({
                name: $(el).find('.skill-item-name').text().trim(),
                endorsements: parseInt($(el).find('.skill-item-endorsements').text().trim()) || 0
            });
        });
        return skills;
    }

    private extractCertifications($: cheerio.Root): ICertification[] {
        const certifications: ICertification[] = [];
        $('.certification-item').each((_, el) => {
            certifications.push({
                name: $(el).find('.certification-item-name').text().trim(),
                organization: $(el).find('.certification-item-org').text().trim(),
                issueDate: $(el).find('.certification-item-date').text().trim()
            });
        });
        return certifications;
    }

    private parseExperiencesFromApi(apiResponse: any): IExperience[] {
        try {
            const elements = apiResponse?.included || [];
            
            return elements
                .filter((el: any) => el.$type === 'com.linkedin.voyager.identity.profile.Position')
                .map((exp: any) => {
                    const company = elements.find((el: any) => 
                        el.$type === 'com.linkedin.voyager.entities.shared.MiniCompany' && 
                        el.entityUrn === exp.companyUrn
                    );

                    const period = this.formatPeriod(exp.timePeriod);
                    const endDate = exp.timePeriod?.endDate ? 
                        new Date(exp.timePeriod.endDate.year, exp.timePeriod.endDate.month - 1) : 
                        new Date();

                    return {
                        empresa: exp.companyName || company?.name || '',
                        cargo: exp.title || '',
                        periodo: period,
                        descricao: exp.description || '',
                        endDate: endDate.toISOString(),
                        skills: []
                    };
                })
                .sort((a: IExperience, b: IExperience) => {
                    const aDate = new Date(a.endDate || Date.now());
                    const bDate = new Date(b.endDate || Date.now());
                    return bDate.getTime() - aDate.getTime();
                });
        } catch (error) {
            console.error('Erro ao processar experiências:', error);
            return [];
        }
    }

    private formatPeriod(period: any): string {
        if (!period) return '';
        
        const start = period.startDate ? 
            `${this.getMonthName(period.startDate.month)}/${period.startDate.year}` : '';
        const end = period.endDate ? 
            `${this.getMonthName(period.endDate.month)}/${period.endDate.year}` : 'Presente';
        
        return `${start} - ${end}`;
    }

    private getMonthName(month: number): string {
        const months = [
            'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
            'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
        ];
        return months[month - 1] || '';
    }
}