import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

export interface PublicFooterSettingsDto {
  companyRuc: string;
  companyBusinessName: string;
  storeName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5036/api/v1';
const PUBLIC_FOOTER_ENDPOINT = API_URL.endsWith('/api')
  ? `${API_URL}/v1/settings/public-footer`
  : `${API_URL}/settings/public-footer`;

export function useStoreConfig() {
  return useQuery({
    queryKey: ['store-config'],
    queryFn: async (): Promise<PublicFooterSettingsDto> => {
      const { data } = await axios.get(PUBLIC_FOOTER_ENDPOINT);
      // Handle camelCase response from API
      return {
        companyRuc: data.companyRuc,
        companyBusinessName: data.companyBusinessName,
        storeName: data.storeName,
        companyAddress: data.companyAddress,
        companyPhone: data.companyPhone,
        companyEmail: data.companyEmail,
      };
    },
    staleTime: 1000 * 60, // 1 minute
    retry: 1,
  });
}
