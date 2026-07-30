import axios from "axios";

import { PersistedUser } from "@/app/domain/schema";

const UserResource = {
  save: (user: PersistedUser) =>
    axios.post("/api/user/settings", {
      user,
    }),
};

export default UserResource;
