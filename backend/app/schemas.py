from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    """What we expect in the request body when someone registers."""
    email: EmailStr
    username: str
    password: str


class UserLogin(BaseModel):
    """What we expect when someone logs in - either field can be
    an email or a username, we'll figure out which at login time."""
    identifier: str
    password: str


class UserResponse(BaseModel):
    """What we send back after registration - notice password_hash
    is NOT here. We never want to send hashed passwords back to the
    client, even though it's not the plaintext password."""
    id: int
    email: str
    username: str

    class Config:
        from_attributes = True  # lets this be built directly from a SQLAlchemy User object


class Token(BaseModel):
    """What we send back after a successful login."""
    access_token: str
    token_type: str = "bearer"
