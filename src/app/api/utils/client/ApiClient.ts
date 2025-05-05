import FileResource from "@/app/api/utils/resources/FileResource";
import AiSearchQueryResource from "@/app/api/utils/resources/AiSearch";

const ApiClient = {
  files: FileResource,
  aiSearch: AiSearchQueryResource,
};

export default ApiClient;
