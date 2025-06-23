import AiSearchQueryResource from "@/app/api/utils/resources/AiSearch";
import { CacheResource } from "@/app/api/utils/resources/Cache";
import FileResource from "@/app/api/utils/resources/FileResource";
import UserResource from "@/app/api/utils/resources/User";
const ApiClient = {
  files: FileResource,
  aiSearch: AiSearchQueryResource,
  user: UserResource,
  cache: CacheResource,
};

export default ApiClient;
