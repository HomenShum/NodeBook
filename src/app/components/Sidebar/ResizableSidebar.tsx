import {
  BellDotIcon,
  FileSpreadsheet,
  Globe,
  HelpCircle,
  History,
  Home,
  Key,
  ListIcon,
  LogIn,
  LogOut,
  Mail,
  MoonIcon,
  Newspaper,
  Search,
  SettingsIcon,
  SunIcon,
  User,
} from "lucide-react";
import { action } from "mobx";
import { observer } from "mobx-react-lite";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/app/auth/useAuth";
import { ClearData } from "@/app/components/DataDialog/ClearData";
import { ImportDialog } from "@/app/components/DataDialog/ImportDialog";
import { HelpModal } from "@/app/components/HelpModal/HelpModal";
import { NotificationPane } from "@/app/components/Notifications/NotificationPane";
import { MyFavoritesList } from "@/app/components/Sidebar/MyFavoritesTree";
import { MyHashtagsTree } from "@/app/components/Sidebar/MyHashtagsTree";
import { Button } from "@/app/components/UIPrimitives/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/UIPrimitives/DropdownMenu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/UIPrimitives/Tooltip";
import { DevTools } from "@/app/components/dev/DevTools";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useSettingsStore } from "@/app/contexts/SettingsStoreContext";
import { useUser } from "@/app/contexts/UserContext";
import { useOpenNewTab, useSetMainRoot } from "@/app/tree/utils";
import { ViewType } from "@/app/view/types";
import { useViewStore } from "@/app/view/useViewStore";
import { GLOBAL_ROOT_ID } from "@/lib/constants";
import { cn } from "@/lib/utils";

import styles from "./ResizableSidebar.module.css";

interface Props {
  isOpen: boolean;
  minWidth?: number;
  maxWidth?: number;
  className?: string;
  onResizeStateChange: (isResizing: boolean) => void;
}

export const ResizableSidebar = observer(function ResizableSidebar({
  isOpen,
  minWidth = 150,
  maxWidth = 450,
  className,
  onResizeStateChange,
}: Props) {
  const auth = useAuth();
  const user = useUser();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const resizerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [activePointerId, setActivePointerId] = useState<number | null>(null);

  const graphStore = useGraphStore();
  const settingsStore = useSettingsStore();
  const viewStore = useViewStore();
  const setRoot = useSetMainRoot();
  const openNewTab = useOpenNewTab();
  const router = useRouter();

  const handleOpenDevTools = () => {
    viewStore.setActiveModal("devTools");
  };

  const openHelpModal = () => {
    viewStore.setActiveModal("help");
  };

  const toggleNotificationsPane = () => {
    viewStore.setNotificationPaneOpen(!viewStore.notificationPaneOpen);
  };

  const handleLogout = useCallback(() => {
    if (!auth) return;
    auth.logout({ logoutParams: { returnTo: window.location.origin } });
  }, [auth]);

  const startResizing = useCallback(
    (e: React.PointerEvent) => {
      setIsResizing(true);
      onResizeStateChange(true);
      setActivePointerId(e.pointerId); // Store the pointerId
      e.preventDefault();
      e.stopPropagation();

      if (resizerRef.current) {
        resizerRef.current.setPointerCapture(e.pointerId);
      }
    },
    [onResizeStateChange],
  );

  const stopResizing = useCallback(() => {
    setIsResizing(false);
    onResizeStateChange(false);

    // Release the pointer capture
    if (resizerRef.current && activePointerId !== null) {
      resizerRef.current.releasePointerCapture(activePointerId);
    }
    setActivePointerId(null); // Reset the stored pointerId
  }, [onResizeStateChange, activePointerId]);

  const resize = useCallback(
    (e: PointerEvent) => {
      if (isResizing && sidebarRef.current) {
        const newWidth = e.clientX - sidebarRef.current.getBoundingClientRect().left;
        if (newWidth >= minWidth && newWidth <= maxWidth) {
          viewStore.setSidebarWidth(newWidth);
        }
      }
    },
    [isResizing, minWidth, maxWidth, viewStore],
  );

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (isResizing) {
        resize(e);
      }
    };

    const handlePointerUp = () => {
      if (isResizing) {
        stopResizing();
      }
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);

    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isResizing, resize, stopResizing]);

  const handleNavigation = useCallback(
    (action: () => void) => {
      action();
      if (window.innerWidth <= 450) {
        viewStore.toggleLeftSidebar();
      }
    },
    [viewStore],
  );

  return (
    <>
      {isOpen && <div className={styles.Backdrop} onClick={() => viewStore.toggleLeftSidebar()} />}
      <aside
        ref={sidebarRef}
        className={`${styles.Sidebar} ${isOpen ? styles.Open : ""} ${className || ""}`}
        style={{
          width: `${viewStore.sidebarWidth}px`,
        }}
      >
        <div className={`${styles.SidebarContent} ${isResizing ? styles.Resizing : ""}`}>
          <div className={styles.Nav}>
            {settingsStore.showNotifications && (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleNotificationsPane}
                className={cn(styles.ShowTooltip, styles.BottomAlign)}
                data-tooltip="Notifications"
              >
                <BellDotIcon size={16} strokeWidth={1.5} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={openHelpModal}
              className={cn(styles.ShowTooltip, styles.BottomAlign)}
              data-tooltip="Help"
            >
              <HelpCircle size={16} strokeWidth={1.5} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleOpenDevTools}
              className={cn(styles.ShowTooltip, styles.BottomAlign)}
              data-tooltip="Settings"
            >
              <SettingsIcon size={16} strokeWidth={1.5} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(styles.ShowTooltip, styles.BottomAlign)}
                  data-tooltip="Account"
                >
                  <User size={16} strokeWidth={1.5} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {user.isAnonymous && (
                  <DropdownMenuItem className={styles.LogInButton} onSelect={() => auth?.loginWithRedirect()}>
                    <LogIn size={16} strokeWidth={1.5} />
                    <span>Log in</span>
                  </DropdownMenuItem>
                )}
                {!user.isAnonymous && auth && (
                  <>
                    <DropdownMenuItem onSelect={handleLogout} className={styles.LogOutButton}>
                      <LogOut size={16} strokeWidth={1.5} />
                      <span>Log out</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled>
                      <Mail size={16} strokeWidth={1.5} />
                      {user.email}
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled>
                      <Key size={16} strokeWidth={1.5} />
                      {user.id}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className={styles.TopContent}>
            <Button
              variant="ghost"
              className={cn(styles.Button, styles.ShowTooltip, styles.RightAlign)}
              data-tooltip="Go to Global Root"
              onMouseEnter={() => {
                graphStore.layerManager.loadWithIds([GLOBAL_ROOT_ID]);
              }}
              onClick={(e) => {
                if (e.shiftKey) {
                  viewStore.createSidebarTree(graphStore.globalRoot);
                } else if (e.metaKey) {
                  openNewTab(graphStore.globalRoot);
                } else {
                  handleNavigation(() => {
                    setRoot(graphStore.globalRoot);
                    viewStore.setViewType(ViewType.Note);
                  });
                }
              }}
            >
              <span>
                <Globe size={16} strokeWidth={1.5} />
              </span>
              <span className={styles.ButtonText}>{graphStore.globalRoot.text}</span>
            </Button>
            {!user.isAnonymous && (
              <Button
                variant="ghost"
                className={cn(styles.Button, styles.ShowTooltip, styles.RightAlign)}
                data-tooltip="Go to your stream"
                onMouseEnter={() => {
                  graphStore.layerManager.loadWithIds([graphStore.userRoot.id]);
                }}
                onClick={(e) => {
                  if (e.shiftKey) {
                    viewStore.createSidebarTree(graphStore.getDefaultRootForUser());
                  } else if (e.metaKey) {
                    openNewTab(graphStore.getDefaultRootForUser());
                  } else {
                    handleNavigation(() => {
                      setRoot(graphStore.getDefaultRootForUser());
                      viewStore.setViewType(ViewType.Note);
                    });
                  }
                }}
              >
                <span>
                  <Home size={16} strokeWidth={1.5} />
                </span>
                <span className={styles.ButtonText}>Your Stream</span>
              </Button>
            )}
            {!user.isAnonymous && (
              <Button
                variant="ghost"
                className={cn(styles.Button, styles.ShowTooltip, styles.RightAlign)}
                data-tooltip="Go to your list"
                onMouseEnter={() => {
                  graphStore.layerManager.loadWithIds([graphStore.userRoot.id]);
                }}
                onClick={(e) => {
                  if (e.shiftKey) {
                    viewStore.createSidebarTree(graphStore.getDefaultRootForUser());
                  } else if (e.metaKey) {
                    openNewTab(graphStore.getDefaultRootForUser());
                  } else {
                    handleNavigation(() => {
                      setRoot(graphStore.getDefaultRootForUser());
                      viewStore.setViewType(ViewType.Outline);
                    });
                  }
                }}
              >
                <span>
                  <ListIcon size={16} strokeWidth={1.5} />
                </span>
                <span className={styles.ButtonText}>Your List</span>
              </Button>
            )}
            <Button
              variant="ghost"
              className={cn(styles.Button, styles.ShowTooltip, styles.RightAlign)}
              data-tooltip="Go to Query Interface"
              onClick={(e) => {
                if (e.metaKey) {
                  window.open("/query", "_blank");
                } else {
                  handleNavigation(() => router.push("/query"));
                }
              }}
            >
              <span>
                <Search size={16} strokeWidth={1.5} />
              </span>
              <span className={styles.ButtonText}>AI Query</span>
            </Button>
            {!user.isAnonymous && (
              <>
                <div className={styles.SidebarSectionHeader}>Feeds</div>
                <Button
                  variant="ghost"
                  className={cn(styles.Button, styles.ShowTooltip, styles.RightAlign)}
                  data-tooltip="Go to your news feed"
                  onClick={(e) => {
                    if (e.shiftKey) {
                      viewStore.createSidebarTree(graphStore.globalRoot);
                    } else if (e.metaKey) {
                      openNewTab(graphStore.globalRoot);
                    } else {
                      handleNavigation(() => {
                        setRoot(graphStore.globalRoot);
                        viewStore.setFlattenSublists(true);
                      });
                    }
                  }}
                >
                  <span>
                    <Newspaper size={16} strokeWidth={1.5} />
                  </span>
                  <span className={styles.ButtonText}>News Feed</span>
                </Button>
              </>
            )}
            {!user.isAnonymous && (
              <Button
                variant="ghost"
                className={cn(styles.Button, styles.ShowTooltip, styles.RightAlign)}
                data-tooltip="See recently created notes"
                onClick={(e) => {
                  if (e.shiftKey) {
                    viewStore.createSidebarTree(graphStore.globalRoot);
                  } else if (e.metaKey) {
                    openNewTab(graphStore.globalRoot);
                  } else {
                    handleNavigation(() => router.push("/all-nodes"));
                  }
                }}
              >
                <span>
                  <FileSpreadsheet size={16} strokeWidth={1.5} />
                </span>
                <span className={styles.ButtonText}>Recently Created Notes</span>
              </Button>
            )}
            {!user.isAnonymous && (
              <Button
                variant="ghost"
                className={cn(styles.Button, styles.ShowTooltip, styles.RightAlign)}
                data-tooltip="See graph updates"
                onClick={(e) => {
                  if (e.metaKey) {
                    window.open("/updates", "_blank");
                  } else {
                    handleNavigation(() => router.push("/updates"));
                  }
                }}
              >
                <span>
                  <History size={16} strokeWidth={1.5} />
                </span>
                <span className={styles.ButtonText}>Updates Feed</span>
              </Button>
            )}
            {!user.isAnonymous && <MyHashtagsTree />}
            {!user.isAnonymous && <MyFavoritesList />}
          </div>
          <div className={styles.BottomNav}>
            <Button
              variant="ghost"
              size="icon"
              onClick={action(() => {
                viewStore.isDarkMode = !viewStore.isDarkMode;
              })}
              className={cn(styles.ShowTooltip, styles.TopAlign)}
              data-tooltip="Switch Theme"
            >
              {viewStore.isDarkMode ? (
                <SunIcon size={16} strokeWidth={1.5} />
              ) : (
                <MoonIcon size={16} strokeWidth={1.5} />
              )}
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <span className={styles.BetaLabel}>BETA</span>
                </TooltipTrigger>
                <TooltipContent side="top" align="center" sideOffset={5}>
                  This app is in beta testing. It may contain bugs, lose data, or change without notice.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        <div ref={resizerRef} className={styles.Resizer} onPointerDown={startResizing}>
          <div className={styles.ResizerHandle} />
        </div>
      </aside>
      <NotificationPane />
      <HelpModal />
      <DevTools />
      <ImportDialog />
      {user.isAnonymous && (
        <ClearData
          onConfirm={() => {
            graphStore.cleanup();
            viewStore.cleanup();
          }}
        />
      )}
    </>
  );
});
