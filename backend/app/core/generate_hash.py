"""Utility script to generate bcrypt password hashes."""

from getpass import getpass

from app.core.security import hash_password


def main() -> None:
    print("Gerador de hash (bcrypt)")
    plain = getpass("Digite a senha (não aparecerá): ")
    if not plain:
        print("Senha vazia, abortado.")
        return
    hashed = hash_password(plain)
    print("\nHash gerado (copie e use no banco):")
    print(hashed)


if __name__ == "__main__":
    main()
