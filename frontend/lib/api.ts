import axios, { AxiosError } from "axios";
import { UninterceptedApiError } from "@/types/api";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL_DEV || "http://localhost:3000",
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<UninterceptedApiError>) => {
    return Promise.reject(error);
  },
);

export default api;
