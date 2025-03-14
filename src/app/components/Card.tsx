import { GitFork, Heart, MessageCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { RelatedObjectMenu } from "@/app/components/RelatedObject/RelatedObjectMenu";
import { useSetAuthorRoot } from "@/app/tree/utils";
import { cn } from "@/lib/utils";

import styles from "./Card.module.css";

// TODO this seems generic enough not to live in the card component
const getTimeAgo = (date: Date) => {
  const pluralize = (s: string, x: number) => `${s}${x === 1 ? "" : "s"}`;

  const now = new Date();
  const secondsAgo = Math.floor((now.getTime() - date.getTime()) / 1000);

  for (const [unit, secondsInUnit] of Object.entries({
    year: 60 * 60 * 24 * 365,
    month: 60 * 60 * 24 * 30,
    day: 60 * 60 * 24,
    hour: 60 * 60,
    minute: 60,
    second: 1,
  })) {
    const count = Math.floor(secondsAgo / secondsInUnit);
    if (count >= 1) {
      return `${count} ${pluralize(unit, count)} ago`;
    }
  }

  return "now";
};

interface Props {
  children?: React.ReactNode;
  status?: string;
  onStatusClicked?: () => void;
  author?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  relations?: Array<{
    id: string;
    text: string;
  }>;
  likes?: number;
  isLiked?: boolean;
  onLikeClicked?: () => void;
  onCommentSubmit?: (text: string) => void;
  onTextChange?: (text: string) => void;
  onAddRelation?: (text: string) => Promise<void>;
  onRelationClick?: (id: string) => void;
  commentsList?: Array<{
    id: string;
    text: string;
    author: {
      id: string;
      name: string;
    };
    time: Date;
    likes: number;
    isLiked: boolean;
    onLikeClicked: () => void;
  }>;
  initialIsEditing?: boolean;
}

export const Card = ({
  children,
  status,
  onStatusClicked,
  author,
  relations = [],
  likes = 0,
  isLiked = false,
  onLikeClicked,
  onCommentSubmit,
  onTextChange,
  onAddRelation,
  onRelationClick,
  commentsList = [],
  initialIsEditing = false,
}: Props) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [isCommentExpanded, setIsCommentExpanded] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isEditing, setIsEditing] = useState(initialIsEditing);
  const [addRelatedText, setAddRelatedText] = useState("");
  const [_updatingRelationType, setUpdatingRelationType] = useState(false);
  const setAuthorRoot = useSetAuthorRoot();
  const textRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    const checkOverflow = () => {
      if (textRef.current) {
        const lineHeight = parseInt(getComputedStyle(textRef.current).lineHeight);
        const maxHeight = lineHeight * 2; // 2 lines
        setIsOverflowing(textRef.current.scrollHeight > maxHeight);
      }
    };

    checkOverflow();
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  }, [children]);

  const text = children?.toString() || "";

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !onCommentSubmit) return;

    onCommentSubmit(commentText.trim());
    setCommentText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      setIsEditing(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onTextChange) {
      onTextChange(e.target.value);
    }
  };

  const handleAddRelated = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && addRelatedText.trim() && onAddRelation) {
      e.preventDefault();
      await onAddRelation(addRelatedText.trim());
      setAddRelatedText("");
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.contentWrapper}>
        <div ref={textRef} className={`${styles.cardText} ${!isExpanded && isOverflowing ? styles.clampText : ""}`}>
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              style={{
                width: "100%",
                background: "none",
                border: "none",
                padding: 0,
                margin: 0,
                fontSize: "inherit",
                color: "inherit",
                outline: "none",
              }}
            />
          ) : (
            text
          )}
        </div>
        <RelatedObjectMenu setUpdatingRelationType={setUpdatingRelationType} />
      </div>

      {isOverflowing && !isEditing && (
        <div className={styles.showMore} onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? "Show less" : "Show more"}
        </div>
      )}

      <div className={styles.cardFooter}>
        <div className={styles.menuButton}>
          <GitFork className={styles.addRelatedIcon} size={16} style={{ transform: "scaleY(-1)" }} />
          <input
            type="text"
            placeholder="Add Related..."
            className={styles.addRelatedField}
            value={addRelatedText}
            onChange={(e) => setAddRelatedText(e.target.value)}
            onKeyDown={handleAddRelated}
          />
        </div>

        {author && (
          <div className={styles.authorInfo} onClick={() => setAuthorRoot(author.id)} role="button" tabIndex={0}>
            {author.avatarUrl && (
              <div className={styles.avatar}>
                <img src={author.avatarUrl} alt={author.name} />
              </div>
            )}
            <span className={styles.authorName}>{author.name}</span>
          </div>
        )}
        <div className={styles.status} onClick={onStatusClicked}>
          <span className={styles.statusDot} /> {status}
        </div>
        <div className={styles.footerRight}>
          <div className={styles.engagement}>
            <div className={cn(styles.engagementItem, isLiked && styles.active)} onClick={onLikeClicked}>
              <Heart strokeWidth={2.5} size={18} />
              <span className={styles.engagementText}>{likes}</span>
            </div>
            <div
              className={cn(styles.engagementItem, isCommentExpanded && styles.active)}
              onClick={() => setIsCommentExpanded(!isCommentExpanded)}
            >
              <MessageCircle strokeWidth={2.5} size={18} style={{ transform: "scaleX(-1)" }} />
              <span className={styles.engagementText}>{commentsList.length}</span>
            </div>
          </div>
        </div>
      </div>

      {relations.length > 0 && (
        <div className={styles.cardEnd}>
          <div className={styles.relations}>
            {relations.map((relation) => (
              <div
                key={relation.id}
                className={styles.relation}
                onClick={() => onRelationClick?.(relation.id)}
                role="button"
                tabIndex={0}
              >
                {relation.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {isCommentExpanded && (
        <>
          <form onSubmit={handleCommentSubmit} className={styles.commentForm}>
            <input
              type="text"
              placeholder="Write a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className={styles.commentInput}
            />
            <button type="submit" className={cn(styles.menuButton, styles.submitButton)} disabled={!commentText.trim()}>
              Submit
            </button>
          </form>

          {commentsList.length > 0 && (
            <div className={styles.commentsSection}>
              {commentsList.map((comment) => (
                <div key={comment.id} className={styles.commentItem}>
                  <div className={styles.commentHeader}>
                    <div>
                      <button className={styles.commentAuthor} onClick={() => setAuthorRoot(comment.author.id)}>
                        {comment.author.name}
                      </button>
                      <span className={styles.commentTime}>{getTimeAgo(comment.time)}</span>
                    </div>

                    <div
                      className={cn(styles.commentLike, comment.isLiked && styles.active)}
                      onClick={comment.onLikeClicked}
                    >
                      <Heart size={12} />
                      <span>{comment.likes}</span>
                    </div>
                  </div>
                  {comment.text}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
