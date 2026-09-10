from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app import auth, coach_rate_limit, coach_service, models, schemas

router = APIRouter()


def _owned_conversation(
    conversation_id: int, user: models.User, db: Session
) -> models.CoachConversation:
    conversation = (
        db.query(models.CoachConversation)
        .filter(
            models.CoachConversation.id == conversation_id,
            models.CoachConversation.user_id == user.id,
        )
        .first()
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@router.post("/coach", response_model=schemas.CoachReplyOut)
def send_coach_message(
    payload: schemas.CoachMessageIn,
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db),
):
    """
    Send one turn to the Coach and get its reply.

    Gated with require_profile because the coach is only useful once
    onboarding has supplied a goal, experience level and equipment - without
    those the prompt has nothing user-specific to ground advice in.
    """
    # Checked first, before any DB write or provider call: a rate-limited
    # request must have no side effect at all, not even an orphaned
    # conversation row.
    coach_rate_limit.check_coach_rate_limit(current_user.id)

    if payload.conversation_id is None:
        conversation = models.CoachConversation(
            user_id=current_user.id,
            # First message doubles as the thread title in the history list.
            title=payload.message[:80],
        )
        db.add(conversation)
        db.flush()
    else:
        conversation = _owned_conversation(payload.conversation_id, current_user, db)

    user_message = models.CoachMessage(
        conversation_id=conversation.id, role="user", content=payload.message
    )
    db.add(user_message)
    db.flush()

    history = (
        db.query(models.CoachMessage)
        .filter(models.CoachMessage.conversation_id == conversation.id)
        .order_by(models.CoachMessage.id.asc())
        .all()
    )

    context = coach_service.build_user_context(db, current_user)
    messages = coach_service.build_messages(context, history)

    try:
        reply_text = coach_service.request_completion(messages)
    except coach_service.CoachUnavailable as exc:
        # Roll back the user's turn too: a thread whose last message is an
        # unanswered question would be replayed as such on the next request.
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Coach is unavailable right now. Please try again shortly.",
        ) from exc

    reply = models.CoachMessage(
        conversation_id=conversation.id, role="assistant", content=reply_text
    )
    db.add(reply)
    db.commit()
    db.refresh(reply)

    return {"conversation_id": conversation.id, "reply": reply}


@router.get("/coach/conversations", response_model=list[schemas.CoachConversationOut])
def list_conversations(
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.CoachConversation)
        .filter(models.CoachConversation.user_id == current_user.id)
        .order_by(models.CoachConversation.updated_at.desc())
        .all()
    )


@router.get(
    "/coach/conversations/{conversation_id}",
    response_model=list[schemas.CoachMessageOut],
)
def get_conversation_messages(
    conversation_id: int,
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db),
):
    conversation = _owned_conversation(conversation_id, current_user, db)
    return (
        db.query(models.CoachMessage)
        .filter(models.CoachMessage.conversation_id == conversation.id)
        .order_by(models.CoachMessage.id.asc())
        .all()
    )


@router.delete(
    "/coach/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_conversation(
    conversation_id: int,
    current_user: models.User = Depends(auth.require_profile),
    db: Session = Depends(get_db),
):
    conversation = _owned_conversation(conversation_id, current_user, db)
    db.query(models.CoachMessage).filter(
        models.CoachMessage.conversation_id == conversation.id
    ).delete(synchronize_session=False)
    db.delete(conversation)
    db.commit()
