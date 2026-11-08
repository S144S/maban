class PlantError(Exception):
    def __init__(self, message: str, status: int = 409):
        self.message, self.status = message, status
