class WalletError(Exception):
    def __init__(self, message: str, status: int = 400):
        self.message, self.status = message, status
