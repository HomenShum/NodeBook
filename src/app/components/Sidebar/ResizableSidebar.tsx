import {
  BellIcon,
  FileSpreadsheet,
  Globe,
  History,
  Home,
  Key,
  Keyboard,
  LogIn,
  LogOut,
  Mail,
  Mic,
  MoonIcon,
  Newspaper,
  Search,
  SettingsIcon,
  SunIcon,
  User,
} from "lucide-react";
import { action } from "mobx";
import { observer } from "mobx-react-lite";
import { usePathname, useRouter } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";

import appStyles from "@/app/app.module.css";
import { useAuth } from "@/app/auth/useAuth";
import { ClearData } from "@/app/components/DataDialog/ClearData";
import { ImportDialog } from "@/app/components/DataDialog/ImportDialog";
import { HelpModal } from "@/app/components/HelpModal/HelpModal";
import { QuickCaptureIcon } from "@/app/components/Icons/QuickCaptureIcon";
import { NotificationPane } from "@/app/components/Notifications/NotificationPane";
import { LocalHashtagsTree } from "@/app/components/Sidebar/LocalHashtagsTree";
import { LocalMentionsTree } from "@/app/components/Sidebar/LocalMentionsTree";
import { MyFavoritesList } from "@/app/components/Sidebar/MyFavoritesTree";
import { MyHashtagsTree } from "@/app/components/Sidebar/MyHashtagsTree";
import { MyShortlinksTree } from "@/app/components/Sidebar/MyShortlinksTree";
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
import { useNotifications } from "@/app/contexts/NotificationContext";
import { useSettingsStore } from "@/app/contexts/SettingsStoreContext";
import { useUser } from "@/app/contexts/UserContext";
import { GraphStore } from "@/app/graph/GraphStore";
import { useOpenNewTab, useSetMainRoot } from "@/app/tree/utils";
import { ViewStore } from "@/app/view/ViewStore";
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

export type SidebarTab =
  | "globalRoot"
  | "yourRoot"
  | "yourStream"
  | "aiQuery"
  | "globalNewsFeed"
  | "recentlyCreatedNotes"
  | "updatesFeed"
  | "voiceOperations"
  | null;

export function getSelectedSidebarTab(
  viewStore: ViewStore,
  graphStore: GraphStore,
  pathname: string,
  lastClickedTab: SidebarTab | null,
): SidebarTab {
  const rootId = viewStore.treeView.root.object.id;

  if (pathname.startsWith("/query")) return "aiQuery";
  if (pathname.startsWith("/voice-operations")) return "voiceOperations";
  if (pathname.startsWith("/updates")) return "updatesFeed";
  if (pathname.startsWith("/all-nodes")) return "recentlyCreatedNotes";

  if (rootId === graphStore.userRoot.id) return "yourRoot";
  if (rootId === graphStore.myStreamNode.id) return "yourStream";

  // Distinguish between globalRoot and globalNewsFeed using the flattenSublists view state
  if (rootId === graphStore.globalRoot.id) {
    return viewStore.flattenSublists ? "globalNewsFeed" : "globalRoot";
  }

  // Return null when no sidebar tab matches the current page state
  // This ensures sidebar items are only highlighted when their respective pages are active
  return null;
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
  const { unreadCount } = useNotifications();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const resizerRef = useRef<HTMLDivElement>(null);
  const scrollableRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [activePointerId, setActivePointerId] = useState<number | null>(null);
  const [showTopBorder, setShowTopBorder] = useState(false);
  const [showBottomBorder, setShowBottomBorder] = useState(true);
  const [lastClickedTab, setLastClickedTab] = useState<SidebarTab | null>(null);

  const graphStore = useGraphStore();
  const settingsStore = useSettingsStore();
  const viewStore = useViewStore();
  const setRoot = useSetMainRoot();
  const openNewTab = useOpenNewTab();
  const router = useRouter();
  const pathname = usePathname();

  const handleScroll = useCallback(() => {
    if (!scrollableRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollableRef.current;
    const isAtTop = scrollTop === 0;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1; // -1 for rounding errors

    setShowTopBorder(!isAtTop);
    setShowBottomBorder(!isAtBottom);
  }, []);

  useEffect(() => {
    const scrollableElement = scrollableRef.current;
    if (!scrollableElement) return;

    // Initial check
    handleScroll();
    scrollableElement.addEventListener("scroll", handleScroll);
    return () => scrollableElement.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // ResizeObserver to detect content size changes
  useEffect(() => {
    const scrollableElement = scrollableRef.current;
    if (!scrollableElement) return;

    const resizeObserver = new ResizeObserver(() => {
      // Small delay to ensure DOM has updated
      setTimeout(handleScroll, 10);
    });

    resizeObserver.observe(scrollableElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [handleScroll]);

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
    localStorage.clear();
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

  const currentTab = getSelectedSidebarTab(viewStore, graphStore, pathname, lastClickedTab);

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
                className={cn(styles.ShowTooltip, styles.BottomAlign, unreadCount ? appStyles.UnreadNotification : "")}
                data-tooltip="Notifications"
              >
                <BellIcon size={16} strokeWidth={1.5} />
                {unreadCount > 0 && <span>{unreadCount}</span>}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={openHelpModal}
              className={cn(styles.ShowTooltip, styles.BottomAlign, styles.HideOnMobile)}
              data-tooltip="Keyboard Shortcuts"
            >
              <Keyboard size={16} strokeWidth={1.5} />
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
            {!settingsStore.newUser && (
              <Button
                variant="ghost"
                className={cn(styles.Button, currentTab === "globalRoot" && styles.Selected)}
                onMouseEnter={() => {
                  graphStore.layerManager.lazyLoadWithIds([GLOBAL_ROOT_ID]);
                }}
                onClick={(e) => {
                  setLastClickedTab("globalRoot");
                  if (e.shiftKey) {
                    viewStore.createSidePanelTree(graphStore.globalRoot);
                  } else if (e.metaKey) {
                    openNewTab(graphStore.globalRoot);
                  } else {
                    handleNavigation(() => {
                      setRoot(graphStore.globalRoot);
                      viewStore.setFlattenSublists(false);
                    });
                  }
                }}
              >
                <span>
                  <Globe size={16} strokeWidth={1.5} />
                </span>
                <span className={styles.ButtonText}>Global Hub</span>
              </Button>
            )}
            {!user.isAnonymous && (
              <>
                <Button
                  variant="ghost"
                  className={cn(styles.Button, currentTab === "yourRoot" && styles.Selected)}
                  onMouseEnter={() => {
                    graphStore.layerManager.lazyLoadWithIds([graphStore.userRoot.id]);
                  }}
                  onClick={(e) => {
                    setLastClickedTab("yourRoot");
                    if (e.shiftKey) {
                      viewStore.createSidePanelTree(graphStore.getDefaultRootForUser());
                    } else if (e.metaKey) {
                      openNewTab(graphStore.getDefaultRootForUser());
                    } else {
                      handleNavigation(() => {
                        setRoot(graphStore.getDefaultRootForUser());
                        viewStore.setViewType(ViewType.Outline);
                        viewStore.setFlattenSublists(false);
                      });
                    }
                  }}
                >
                  <span>
                    <Home size={16} strokeWidth={1.5} />
                  </span>
                  <span className={styles.ButtonText}>Home</span>
                </Button>
                <Button
                  variant="ghost"
                  className={cn(styles.Button, currentTab === "yourStream" && styles.Selected)}
                  onMouseEnter={() => {
                    graphStore.layerManager.lazyLoadWithIds([graphStore.myStreamNodeId]);
                  }}
                  onClick={(e) => {
                    setLastClickedTab("yourStream");
                    if (e.shiftKey) {
                      viewStore.createSidePanelTree(graphStore.myStreamNode);
                    } else if (e.metaKey) {
                      openNewTab(graphStore.myStreamNode);
                    } else {
                      handleNavigation(() => {
                        setRoot(graphStore.myStreamNode);
                        viewStore.setViewType(ViewType.Note);
                        viewStore.setFlattenSublists(false);
                      });
                    }
                  }}
                >
                  <span>
                    <QuickCaptureIcon />
                  </span>
                  <span className={styles.ButtonText}>My Stream</span>
                </Button>
              </>
            )}
            {!settingsStore.newUser && (
              <Button
                variant="ghost"
                className={cn(styles.Button, currentTab === "aiQuery" && styles.Selected)}
                onClick={(e) => {
                  setLastClickedTab("aiQuery");
                  if (e.metaKey) {
                    window.open("/query", "_blank");
                  } else {
                    handleNavigation(() => {
                      router.push("/query");
                      viewStore.setFlattenSublists(false);
                    });
                  }
                }}
              >
                <span>
                  <Search size={16} strokeWidth={1.5} />
                </span>
                <span className={styles.ButtonText}>AI Query</span>
              </Button>
            )}
            {!settingsStore.newUser && (
              <>
                <div className={styles.SidebarSectionHeader}>Feeds</div>
                <Button
                  variant="ghost"
                  className={cn(styles.Button, currentTab === "globalNewsFeed" && styles.Selected)}
                  onClick={(e) => {
                    setLastClickedTab("globalNewsFeed");
                    if (e.shiftKey) {
                      viewStore.createSidePanelTree(graphStore.globalRoot);
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
                  <span className={styles.ButtonText}>Global News Feed</span>
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              className={cn(styles.Button, currentTab === "recentlyCreatedNotes" && styles.Selected)}
              onClick={(e) => {
                setLastClickedTab("recentlyCreatedNotes");
                if (e.shiftKey) {
                  viewStore.createSidePanelTree(graphStore.globalRoot);
                } else if (e.metaKey) {
                  openNewTab(graphStore.globalRoot);
                } else {
                  handleNavigation(() => {
                    router.push("/all-nodes");
                    viewStore.setFlattenSublists(false);
                  });
                }
              }}
            >
              <span>
                <FileSpreadsheet size={16} strokeWidth={1.5} />
              </span>
              <span className={styles.ButtonText}>Recently Created Notes</span>
            </Button>
            {!user.isAnonymous && !settingsStore.newUser && (
              <Button
                variant="ghost"
                className={cn(styles.Button, currentTab === "updatesFeed" && styles.Selected)}
                onClick={(e) => {
                  setLastClickedTab("updatesFeed");
                  if (e.metaKey) {
                    window.open("/updates", "_blank");
                  } else {
                    handleNavigation(() => {
                      router.push("/updates");
                      viewStore.setFlattenSublists(false);
                    });
                  }
                }}
              >
                <span>
                  <History size={16} strokeWidth={1.5} />
                </span>
                <span className={styles.ButtonText}>Updates Feed</span>
              </Button>
            )}
            {/* Voice Operations Button */}
            {!user.isAnonymous && (
              <Button
                variant="ghost"
                className={cn(styles.Button, currentTab === "voiceOperations" && styles.Selected)}
                onClick={(e) => {
                  setLastClickedTab("voiceOperations");
                  if (e.metaKey) {
                    window.open("/voice-operations", "_blank");
                  } else {
                    handleNavigation(() => {
                      router.push("/voice-operations");
                      viewStore.setFlattenSublists(false);
                    });
                  }
                }}
              >
                <span>
                  <Mic size={16} strokeWidth={1.5} />
                </span>
                <span className={styles.ButtonText}>Voice Operations</span>
              </Button>
            )}
          </div>
          <div
            className={cn(
              styles.ScrollableArea,
              showTopBorder && styles.ShowTopBorder,
              showBottomBorder && styles.ShowBottomBorder,
            )}
            ref={scrollableRef}
          >
            <MyFavoritesList />
            <MyHashtagsTree />
            <MyShortlinksTree />
            <LocalHashtagsTree />
            <LocalMentionsTree />
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
        {isOpen && (
          <div ref={resizerRef} className={styles.Resizer} onPointerDown={startResizing}>
            <div className={styles.ResizerHandle} />
          </div>
        )}
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
