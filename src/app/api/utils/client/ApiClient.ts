import FileResource from "@/app/api/utils/resources/FileResource";
import AiSearchQueryResource from "@/app/api/utils/resources/AiSearch";
import UserResource from "@/app/api/utils/resources/User";

const ApiClient = {
  files: FileResource,
  aiSearch: AiSearchQueryResource,
  user: UserResource,
};

export default ApiClient;
